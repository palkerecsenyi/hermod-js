import { Writer } from './output';
import { EndpointArgument, Service } from '../service/request';
import { Config } from './parser';
import camelcase from 'camelcase';
import { resolveTypeName, resolveUnitDefinition } from './types';
import { writeUnitDefinition } from './unit';

function getUnitTypeName(endpointArgument: EndpointArgument | undefined, w: Writer, fileName: string, configs: Config[]): string {
    if (!endpointArgument) {
        return 'undefined'
    } else {
        return resolveTypeName(w, endpointArgument.unit, fileName, configs, true, true)
    }
}

function writeNullableUnitDefinition(w: Writer, endpointArgument: EndpointArgument | undefined, configs: Config[], fileName: string) {
    if (!endpointArgument) {
        w.write('undefined')
    } else {
        const [unit] = resolveUnitDefinition(endpointArgument.unit, configs)
        if (!unit) throw new Error("unit not found for service")
        writeUnitDefinition(w, unit, fileName, configs)
    }
}

export default function writeService(w: Writer, service: Service, fileName: string, configs: Config[]) {
    w.writeln(`// Service: ${service.name}`)

    for (const endpoint of service.endpoints) {
        const apiPathName = camelcase(endpoint.path.split('/').reverse().join('_'), {pascalCase: true})

        w.importDefault('dist/service/request', false, 'ServerConfig')
        w.importDefault('dist/service/readwriter', false, 'ServiceReadWriter')

        const inTypeName = getUnitTypeName(endpoint.in, w, fileName, configs)
        const outTypeName = getUnitTypeName(endpoint.out, w, fileName, configs)
        w.writeln(`export function request${apiPathName}(serverConfig?: ServerConfig): ServiceReadWriter<${inTypeName}, ${outTypeName}> {`)
        w.writelni(1, `return new ServiceReadWriter<${inTypeName}, ${outTypeName}>('${endpoint.path}', serverConfig, `)
        writeNullableUnitDefinition(w, endpoint.in, configs, fileName)
        w.write(',')
        writeNullableUnitDefinition(w, endpoint.out, configs, fileName)
        w.write(')')
        w.writeln('}')
    }
}

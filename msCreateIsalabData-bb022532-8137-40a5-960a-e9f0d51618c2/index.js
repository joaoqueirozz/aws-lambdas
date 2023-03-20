// layers
const utils = require("utils.js");
const transform = require('dataTransform');
const models = require('models');

// Map
const enumerator = require(`./map/enumerator`);

// modules
const dynamo = require('./modules/dynamodb');
const ssm = require('./modules/ssm');
const rds = require('./modules/rds');
const nodeFetch = require('./modules/nodefetch');

let env;

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (!event.Records || event.Records.length === 0) {
        return {
            message: "Nothing to process"
        };
    }

    console.log(JSON.stringify(event));

    try {
        for (let index = 0; index < event.Records.length; index++) {

            const body = utils.assertRequiredValue("body", JSON.parse(event.Records[index].body), "object");
            const schema = utils.assertRequiredValue("schema", body.schema, "string");
            const payload = utils.assertRequiredValue("payload", body.payload, "object");
            console.log(`>>> ${JSON.stringify(payload)} <<<`);

            env = utils.assertRequiredValue("env", body.env, "string");
            console.log(`>>> ${env} <<<`);

            // Verifica se o atendimento existe na tabela de controle
            const encounter = await dynamo.getControlTable(env, "Encounter", body.episodeId)

            // Se o atendimento já foi importado passa para a próxima iteração.
            if (encounter) continue;

            try {

                let newConvertPayload = {};

                // Busca parametros no SSM
                const params = await ssm.getConfig();

                // Abre conexão com o RDS
                await rds.connect(params.connection, env === 'prd' ? `datawarehouse` : `datawarehouse_${env}`);

                // Executa a query no BD
                const data = await rds.get(payload[0].episode_id);

                // Converte dados para importação DW
                const convertPayload = await transform.convertDataMapping(env, models, "Isalab", "Coverage", data, enumerator, "Export", "create");

                // Cria estrutura de envio dos dados
                createStructure("Array", newConvertPayload, `patients`)
                newConvertPayload['patients'].push(convertPayload);
                console.log(`>>> ${JSON.stringify(newConvertPayload)} <<<`);

                const response = await nodeFetch.post(newConvertPayload);
                console.log(JSON.stringify(response));

                // Atualiza tabela de controle
                await dynamo.updateControlTable(env, 'Encounter', payload[0]["episode_id"], response[0].id, new Date().toISOString());
                console.log(">>> Dados gravado na tabela de controle de ID's <<<");

            } catch (err) {
                console.log(JSON.stringify(err));
                throw err
            } finally {
                models.destroy();
            }
        }

        return {
            message: "Gravação realizada com sucesso"
        };

    } catch (err) {
        utils.handleError(err);
    }
};

// Cria a estrutura de um objeto
function createStructure(type, response, field) {
    if (type === "Object" && !response[field]) {
        response[field] = {};
    }

    if (type === "Array" && !response[field]) {
        response[field] = [];
    }
}
const deepReplaceInObject = require('deep-replace-in-object');

// Formata retorno do payload
function formatPayload(payload, resourceType, id, oldId) {
    payload.entry.forEach(element => {
        if (element.resource.resourceType === resourceType && element.fullUrl === oldId) {
            element['id'] = id;
            delete element.fullUrl;
            delete element.resource.id;
        }
    });

    return payload;
}

async function execute(event, client, models) {
    try {
        let newEvent = {
            db_connection: event.db_connection,
            db_schema: event.db_schema
        };

        let payload = event.payload;

        // insere o paciente/endereço/contatos através de uma transação
        return await models.Life.knex().transaction(async trx => {
            try {

                for (let index = 0; index < event.data.length; index++) {
                    const element = event.data[index];

                    newEvent.data = element;
                    newEvent.resourceType = element.resourceType;
                    newEvent.organizationType = 'pay';

                    const response = await require(`./${newEvent.resourceType.toLowerCase()}`).executeBundle(models, newEvent, trx);

                    console.log(JSON.stringify(response));

                    event.data = deepReplaceInObject(newEvent.data.fullUrl, response['id'], event.data);
                    payload = deepReplaceInObject(`${newEvent.resourceType}/${newEvent.data.fullUrl}`, `${newEvent.resourceType}/${response['id']}`, payload);
                    payload = formatPayload(payload, newEvent.resourceType, response['id'], newEvent.data.fullUrl);
                }

                return payload;

            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    } finally {
        models.destroy();
    }
}

module.exports = {
    execute
}
const utils = require("utils");

async function checkIfExists(model, document) {
    const results = await model.query().where('document_identification_primary', document);
    if (results && results.length > 0) {
        throw utils.buildCustomError(409, 'A empresa já existe na base de dados');
    }
}

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(models, event) {
    // declara e inicializa o esquema
    const schema = event.db_schema;

    try {
        // verifica se a empresa existe
        // await checkIfExists(models.CareSite, event.data.main.data.document_identification_primary);

        // insere a empresa/endereço/contatos através de uma transação
        return await models.CareSite.knex().transaction(async trx => {
            try {
                // insere a empresa
                const ids = await models.CareSite.knex().insert(event.data.main.data, 'id').into(`${schema}.care_sites`).transacting(trx);

                // formata o id da empresa que acabou de ser inserida
                const insertedId = parseInt(ids[0], 10);

                // verifica entidades aninhadas
                const locationsObj = event.data.secondary['care_site_locations'];
                const contactsObj = event.data.secondary['care_site_contacts'];
                let availabilityObj = event.data.secondary['care_site_availability'];

                // insere o endereço
                if (locationsObj) {
                    locationsObj.care_site_id = insertedId;
                    await models.CareSite.knex().insert(locationsObj).into(`${schema}.care_site_locations`).transacting(trx);
                }

                // insere o contato
                if (contactsObj) {
                    contactsObj.care_site_id = insertedId;
                    await models.CareSite.knex().insert(contactsObj).into(`${schema}.care_site_contacts`).transacting(trx);
                }

                // insere o horário de funcionamento
                if (availabilityObj) {
                    availabilityObj = availabilityObj.map(item => {
                        item.care_site_id = insertedId;
                        return item;
                    });

                    await models.CareSite.knex().insert(availabilityObj).into(`${schema}.care_site_availability`).transacting(trx);
                }

                // mergeia os objetos inseridos num só para retorna para o cliente
                extend(event.data.main.data, event.data.secondary['care_site_locations']);
                extend(event.data.main.data, event.data.secondary['care_site_contacts']);
                event.data.main.data.care_site_availability = availabilityObj;
                event.data.main.data.id = insertedId.toString();

                return event.data.main.data;
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
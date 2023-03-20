const utils = require("utils");

async function checkPractitionerExists(model, data) {
    const results = await model.query()
        .where('document_identification_primary', data.document_identification_primary)
        .orWhere('national_provider_identification', data.national_provider_identification);

    if (results && results.length > 0) {
        throw utils.buildCustomError(409, 'O provedor já existe na base de dados');
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
        // verifica se o paciente existe
        await checkPractitionerExists(models.Provider, event.data.main.data);

        // insere o paciente/endereço/contatos através de uma transação
        return await models.Provider.knex().transaction(async trx => {
            try {
                // insere o paciente
                const ids = await models.Provider.knex().insert(event.data.main.data, 'id').into(`${schema}.providers`).transacting(trx);

                // formata o id do paciente que acabou de ser inserido
                const insertedId = parseInt(ids[0], 10);

                // verifica entidades aninhadas
                const locationsObj = event.data.secondary['provider_locations'];
                const contactsObj = event.data.secondary['provider_contacts'];

                // insere o endereço
                if (locationsObj) {
                    locationsObj.provider_id = insertedId;
                    await models.Provider.knex().insert(locationsObj).into(`${schema}.provider_locations`).transacting(trx);
                }

                // insere o contato
                if (contactsObj) {
                    contactsObj.provider_id = insertedId;
                    await models.Provider.knex().insert(contactsObj).into(`${schema}.provider_contacts`).transacting(trx);
                }

                // mergeia os objetos inseridos num só para retorna para o cliente
                extend(event.data.main.data, event.data.secondary['provider_locations']);
                extend(event.data.main.data, event.data.secondary['provider_contacts']);
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
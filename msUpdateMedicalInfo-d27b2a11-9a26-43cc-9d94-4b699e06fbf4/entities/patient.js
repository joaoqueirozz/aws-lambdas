const utils = require('utils.js');

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(event, client) {
    // declara e inicializa o esquema
    const schema = event.db_schema;

    event.data.main.data['id'] = event.id;

    try {
        return await client.transaction(async trx => {
            try {
                const data = await client(`${schema}.lives`).where('id', '=', event.id).update(event.data.main.data).returning('*').transacting(trx);

                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                const locationsObj = event.data.secondary['life_locations'];
                const contactsObj = event.data.secondary['life_contacts'];

                if (locationsObj) {
                    const updateData = await client(`${schema}.life_locations`).where('life_id', '=', event.id).update(locationsObj).transacting(trx);

                    if (updateData === 0) {
                        locationsObj.life_id = event.id;
                        await client(`${schema}.life_locations`).insert(locationsObj).transacting(trx);
                    }
                }

                if (contactsObj) {
                    const updateData = await client(`${schema}.life_contacts`).where('life_id', '=', event.id).update(contactsObj).transacting(trx);

                    if (updateData === 0) {
                        contactsObj.life_id = event.id;
                        await client(`${schema}.life_contacts`).insert(contactsObj).transacting(trx);

                    }
                }

                // mergeia os objetos inseridos num só para retorna para o cliente
                extend(event.data.main.data, event.data.secondary['life_locations']);
                extend(event.data.main.data, event.data.secondary['life_contacts']);
                event.data.main.data.id = event.id.toString();

                return event.data.main.data;

            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw buildErrorMessage(err);
    } finally {
        client.destroy();
    }
}

function buildErrorMessage(err) {
    switch (err.constraint) {
        case 'lives_pk':
            throw utils.buildCustomError(409, 'Chave primária duplicada');
        case 'lives_un_identification_app':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse identificador de aplicativo');
        case 'lives_un_identification_card':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse número de carteirinha');
        case 'lives_un_identification_health':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse número de cartão SUS');
        case 'lives_un_identification_primary':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse CPF');
        case 'lives_un_identification_secondary':
            throw utils.buildCustomError(409, 'Já existe um paciente com esse RG');
        default:
            throw utils.buildCustomError(400, err.detail || err.message);
    }
}

module.exports = {
    execute
}
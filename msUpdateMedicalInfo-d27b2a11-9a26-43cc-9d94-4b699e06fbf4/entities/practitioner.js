const utils = require('utils.js');

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(event, client) {
    const schema = event.db_schema;

    event.data.main.data['id'] = event.id;

    try {
        return await client.transaction(async trx => {
            try {
                const data = await client(`${schema}.providers`).where('id', '=', event.id).update(event.data.main.data).returning('*').transacting(trx);

                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                const locationsObj = event.data.secondary['provider_locations'];
                const contactsObj = event.data.secondary['provider_contacts'];

                if (locationsObj) {
                    const updateData = await client(`${schema}.provider_locations`).where('provider_id', '=', event.id).update(locationsObj).transacting(trx);

                    if (updateData === 0) {
                        locationsObj.provider_id = event.id;
                        await client(`${schema}.provider_locations`).insert(locationsObj).transacting(trx);

                    }
                }

                if (contactsObj) {
                    const updateData = await client(`${schema}.provider_contacts`).where('provider_id', '=', event.id).update(contactsObj).transacting(trx);
                    
                    if (updateData === 0) {
                        contactsObj.provider_id = event.id;
                        await client(`${schema}.provider_contacts`).insert(contactsObj).transacting(trx);

                    }
                }

                // mergeia os objetos inseridos num só para retorna para o cliente
                extend(event.data.main.data, event.data.secondary['provider_locations']);
                extend(event.data.main.data, event.data.secondary['provider_contacts']);
                event.data.main.data.id = event.id.toString();

                return event.data.main.data;

            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

module.exports = {
    execute
}
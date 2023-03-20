const utils = require('utils.js');

function getConfig(type) {
    switch (type) {
        case 'ins': {
            return { // 1
                tablenames: {
                    main: "health_insurances",
                    location: "health_insurance_locations",
                    contact: "health_insurance_contacts"
                },
                foreignKey: 'health_insurance_id',
            }
        }
        case 'prov': {
            return {
                tablenames: {
                    main: "care_sites",
                    location: "care_site_locations",
                    contact: "care_site_contacts"
                },
                foreignKey: 'care_site_id'
            }
        }
        case 'pay': {
            return {
                tablenames: {
                    main: "companies",
                    location: "company_locations",
                    contact: "company_contacts"
                },
                foreignKey: 'company_id'
            }
        }
    }
}

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(event, client) {
    const config = getConfig(event.type);
    const schema = event.db_schema;

    event.data.main.data['id'] = event.id;

    try {
        return await client.transaction(async trx => {
            try {
                const data = await client(`${schema}.${config.tablenames.main}`).where('id', '=', event.id).update(event.data.main.data).transacting(trx).returning('*');

                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                const locationsObj = event.data.secondary[config.tablenames.location];
                const contactsObj = event.data.secondary[config.tablenames.contact];

                if (locationsObj) {
                    await client(`${schema}.${config.tablenames.location}`).where(config.foreignKey, '=', event.id).update(locationsObj).transacting(trx);
                }

                if (contactsObj) {
                    await client(`${schema}.${config.tablenames.contact}`).where(config.foreignKey, '=', event.id).update(contactsObj).transacting(trx);
                }

                // mergeia os objetos inseridos num só para retorna para o cliente
                extend(event.data.main.data, event.data.secondary[config.tablenames.location]);
                extend(event.data.main.data, event.data.secondary[config.tablenames.contact]);
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
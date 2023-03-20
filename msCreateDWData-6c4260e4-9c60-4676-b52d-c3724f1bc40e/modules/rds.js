const knex = require('knex');
const dynamo = require('./dynamodb');

let client;

async function connect(connection) {
    if (!client) {
        client = knex({
            client: 'pg',
            connection
        });
    }
}

async function create(schema, resourceType, entity, data, primaryId, secundaryId, env) {
    try {
        return await client.transaction(async trx => {
            try {

                console.log(JSON.stringify(data));

                // verifica entidades aninhadas
                const dataLocation = data[`care_site_locations`];
                const dataContact = data[`care_site_contacts`];

                // delete o endereço do objeto principal
                if (dataLocation) delete data[`care_site_locations`];

                // insere o contato do objeto principal
                if (dataContact) delete data[`care_site_contacts`];

                // cria no DW
                const ids = await client
                    .insert(data, 'id')
                    .into(`${schema}.${entity}`)
                    .transacting(trx);

                // insere o endereço
                if (dataLocation) {
                    dataLocation[`care_site_id`] = ids[0];
                    dataLocation[`zip`] = dataLocation[`zip`] ? dataLocation[`zip`].padStart(8, '0') : dataLocation[`zip`];

                    await client
                        .insert(dataLocation, 'id')
                        .into(`${schema}.care_site_locations`)
                        .transacting(trx);
                }

                // insere o contato
                if (dataContact) {
                    dataContact['care_site_id'] = ids[0];

                    await client
                        .insert(dataContact, 'id')
                        .into(`${schema}.care_site_contacts`)
                        .transacting(trx);
                }

                console.log(JSON.stringify(secundaryId));
                console.log(JSON.stringify(ids[0]));

                // cria na tabela de controle
                await dynamo.updateControl(resourceType, env, primaryId, secundaryId, ids[0]);
                console.log(`>>> Registro #${ids[0]} criado com sucesso <<<`);
            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    }
}

async function update(schema, entity, data) {
    try {
        return await client.transaction(async trx => {
            try {
                await client(`${schema}.${entity}`)
                    .where('id', '=', data.id)
                    .update(data)
                    .transacting(trx);

                console.log(`Registro #${data.id} atualizado com sucesso`);
            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    }
}

function disconnect() {
    if (client) {
        client.destroy();
        client = null;
    }
}

module.exports = {
    connect,
    create,
    update,
    disconnect
}
const utils = require('utils.js');

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function execute(event, client) {
    try {
        // inicializa variáveis
        const schema = event.db_schema;
        const careTeamData = event.data.main.data;

        careTeamData['id'] = event.id;

        // guarda os médicos em uma variável separada
        let practitioners;
        if (event.data.main.data.practitioners) {
            practitioners = Object.assign([], event.data.main.data.practitioners);
            delete event.data.main.data.practitioners;
        }

        // inicia transação
        return await client.transaction(async trx => {
            try {
                // se o id do grupo foi informado
                if (careTeamData.care_team_lives_id) {
                    // busca o grupo
                    const groups = await client(`${schema}.care_team_lives`)
                        .where('id', '=', careTeamData.care_team_lives_id)
                        .select('id')
                        .transacting(trx);

                    // verifica se o grupo existe
                    if (!groups || groups.length === 0) {
                        throw utils.buildCustomError(404, `Recurso Group/${careTeamData.care_team_lives_id} não encontrado`);
                    }
                }

                // atualiza care team
                const data = await client(`${schema}.care_teams`)
                    .where('id', '=', event.id)
                    .update(careTeamData)
                    .returning('*')
                    .transacting(trx);

                // verifica se o care team existe
                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                // atualiza o grupo de médicos
                if (practitioners) {
                    // exclui os médicos antigos
                    await client(`${schema}.care_team_providers`)
                        .where('care_team_id', '=', event.id)
                        .del()
                        .transacting(trx);

                    const updatePractitioners = practitioners.map(item => {
                        return {
                            care_team_id: event.id,
                            provider_id: item.id
                        }
                    });

                    // insere os médicos novos
                    await client
                        .insert(updatePractitioners)
                        .into(`${schema}.care_team_providers`)
                        .transacting(trx);
                }

                // verifica entidades aninhadas
                const locationsObj = event.data.secondary['care_team_locations'];

                // atualiza o endereço
                if (locationsObj) {
                    const data = await client(`${schema}.care_team_locations`)
                        .where('care_team_id', '=', event.id)
                        .update(locationsObj)
                        .returning('*')
                        .transacting(trx);

                    // se o endereço ainda não existe, insere
                    if (!data || data.length === 0) {
                        locationsObj.care_team_id = event.id;
                        await client(`${schema}.care_team_locations`)
                            .insert(locationsObj)
                            .transacting(trx);
                    }
                }

                // mergeia os objetos inseridos num só para retornar para o cliente
                extend(event.data.main.data, event.data.secondary['care_team_locations']);
                event.data.main.data.practitioners = practitioners;
                event.data.main.data.id = event.id;

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
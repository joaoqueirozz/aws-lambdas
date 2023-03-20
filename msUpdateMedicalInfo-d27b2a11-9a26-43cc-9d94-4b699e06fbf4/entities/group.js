const utils = require('utils.js');

async function execute(event, client) {
    try {
        // inicializa schema
        const schema = event.db_schema;

        event.data.main.data['id'] = event.id;

        if (event.type === "person") {
            // inicia transação
            return await client.transaction(async trx => {
                try {
                    // busca o grupo
                    const groups = await client(`${schema}.care_team_lives`)
                        .where('id', '=', event.id)
                        .select('id')
                        .transacting(trx);

                    // verifica se o grupo existe
                    if (!groups || groups.length === 0) {
                        throw utils.buildCustomError(404, 'Recurso não encontrado');
                    }

                    // atualiza o grupo
                    const updateData = event.data.main.data.groupToUpdate;
                    for (let i = 0; i < updateData.length; i++) {
                        // busca o paciente
                        const patients = await client(`${schema}.lives`)
                            .where('id', '=', updateData[i].id)
                            .select('id')
                            .transacting(trx);

                        // verifica se o paciente existe
                        if (!patients || patients.length === 0) {
                            throw utils.buildCustomError(404, `Recurso Patient/${updateData[i].id} não encontrado`);
                        }

                        // monta objeto para atualização
                        const updateObject = {
                            id: event.id,
                            life_id: updateData[i].id
                        };

                        if (updateData[i].exclude) { // exclui paciente
                            const data = await client(`${schema}.care_team_lives`)
                                .where(updateObject)
                                .del()
                                .transacting(trx);

                            // verifica se o paciente foi excluído
                            if (!data || data.length === 0) {
                                throw utils.buildCustomError(404, `Recurso Patient/${updateData[i].id} não pertence ao recurso Group/${event.id}`);
                            }
                        } else { // adiciona paciente
                            await client.insert(updateObject)
                                .into(`${schema}.care_team_lives`)
                                .transacting(trx);
                        }
                    }

                    return event.data.main.data;
                } catch (err) {
                    throw err;
                }
            });
        }
        else if (event.type === "site") {
            // inicia transação
            return await client.transaction(async trx => {
                try {
                    // busca o grupo
                    const groups = await client(`${schema}.health_plan_care_sites`)
                        .where('id', '=', event.id)
                        .select('id')
                        .transacting(trx);

                    // verifica se o grupo existe
                    if (!groups || groups.length === 0) {
                        throw utils.buildCustomError(404, 'Recurso não encontrado');
                    }

                    // atualiza o grupo
                    const updateData = event.data.main.data.groupToUpdate;
                    for (let i = 0; i < updateData.length; i++) {
                        // busca a rede credenciada
                        const careSites = await client(`${schema}.care_sites`)
                            .where('id', '=', updateData[i].id)
                            .select('id')
                            .transacting(trx);

                        // verifica se a rede credenciada existe
                        if (!careSites || careSites.length === 0) {
                            throw utils.buildCustomError(404, `Recurso Care Site/${updateData[i].id} não encontrado`);
                        }

                        // monta objeto para atualização
                        const updateObject = {
                            id: event.id,
                            care_site_id: updateData[i].id
                        };

                        if (updateData[i].exclude) { // exclui a rede credenciada
                            const data = await client(`${schema}.health_plan_care_sites`)
                                .where(updateObject)
                                .del()
                                .transacting(trx);

                            // verifica se a rede credenciada foi excluída
                            if (!data || data.length === 0) {
                                throw utils.buildCustomError(404, `Recurso Care Site/${updateData[i].id} não pertence ao recurso Group/${event.id}`);
                            }
                        } else { // adiciona a rede credenciada
                            await client.insert(updateObject)
                                .into(`${schema}.health_plan_care_sites`)
                                .transacting(trx);
                        }
                    }

                    event.data.main.data.id = event.id.toString();
                    return event.data.main.data;
                } catch (err) {
                    throw err;
                }
            });
        }
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

module.exports = {
    execute
}
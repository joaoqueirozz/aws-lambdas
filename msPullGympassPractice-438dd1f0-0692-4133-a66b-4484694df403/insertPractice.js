const modelsDb = require('models');
const utils = require('utils');
const knex = require('knex');

let client;

// inicializa o knex
function getClient(connection) {
    return knex({
        client: 'pg',
        connection
    });
}

// insere a prática no DW
async function run(event) {
    try {
        // inicializa model
        modelsDb.init(event.connection_params, event.db_schema);
        client = getClient(event.connection_params);

        //monta a query
        let rawQuery = [];
        rawQuery.push('select ');
        rawQuery.push('     ( ');
        rawQuery.push(`          select a.id from ${event.db_schema}.associates a `);
        rawQuery.push(`          where a.beneficiary_id = ${event.data.beneficiary_id} `);
        rawQuery.push(`          and active = true `);
        rawQuery.push(`          limit 1 `);
        rawQuery.push('     )  as associate_id, ');
        rawQuery.push('     ( ');
        rawQuery.push(`          select a.company_id from ${event.db_schema}.associates a `);
        rawQuery.push(`          where a.beneficiary_id = ${event.data.beneficiary_id} `);
        rawQuery.push(`          and active = true `);
        rawQuery.push(`          limit 1 `);
        rawQuery.push('     )  as company_id, ');
        rawQuery.push('     ( ');
        rawQuery.push(`          select a.plan_id from ${event.db_schema}.associates a `);
        rawQuery.push(`          where a.beneficiary_id = ${event.data.beneficiary_id} `);
        rawQuery.push(`          and active = true `);
        rawQuery.push(`          limit 1 `);
        rawQuery.push('     )  as current_plan_id, ');
        rawQuery.push('     ( ');
        rawQuery.push(`          select p.id from ${event.db_schema}."plans" p `);
        rawQuery.push(`          where lower(p."name") = lower('${event.data.plan_name}') `);
        rawQuery.push(`          limit 1 `);
        rawQuery.push('     ) as incoming_plan_id, ');
        rawQuery.push('     ( ');
        rawQuery.push(`          select s.id as service_id from ${event.db_schema}.services s `);
        rawQuery.push(`          where lower(s."name") = lower('${event.data.service_name}') `);
        rawQuery.push(`          limit 1 `);
        rawQuery.push('     ) as incoming_service_id ');
        rawQuery = rawQuery.join('');

        const response = (await modelsDb.Life.knex().raw(rawQuery)).rows[0];

        // insere o paciente/endereço/contatos através de uma transação
        return await modelsDb.Life.knex().transaction(async trx => {
            try {
                let finalPlanId;
                let finalServiceId;
                let finalAssociateId;
                let finalPracticeId;

                if (!response.incoming_plan_id) { // plano ainda não existe no DW
                    // cria o plano
                    const planId = await modelsDb.Life.knex().insert({
                        name: event.data.plan_name
                    }, 'id').into(`${event.db_schema}.plans`).transacting(trx);

                    // obtém o id do plano criado
                    finalPlanId = parseInt(planId[0], 10);
                } else { // plano já existe no DW
                    finalPlanId = parseInt(response.incoming_plan_id, 10);
                }

                if (!response.incoming_service_id) { // serviço ainda não existe no DW
                    // cria o serviço
                    const serviceId = await modelsDb.Life.knex().insert({
                        name: event.data.service_name
                    }, 'id').into(`${event.db_schema}.services`).transacting(trx);

                    // obtém o id do serviço criado
                    finalServiceId = parseInt(serviceId[0], 10);
                } else { // serviço já existe no DW
                    finalServiceId = parseInt(response.incoming_service_id, 10);
                }

                if (!response.associate_id) { // associado ainda não existe no DW
                    // cria o associado
                    const associateId = await modelsDb.Life.knex().insert({
                        beneficiary_id: parseInt(event.data.beneficiary_id, 10),
                        plan_id: finalPlanId,
                        company_id: event.data.company_id
                    }, 'id').into(`${event.db_schema}.associates`).transacting(trx);

                    // obtém o id do associado criado
                    finalAssociateId = parseInt(associateId[0], 10);
                } else { // associado já existe no DW
                    if (parseInt(response.current_plan_id, 10) !== finalPlanId) { // mudou o plano
                        // inativa associado com plano antigo
                        await client(`${event.db_schema}.associates`)
                            .where('id', '=', parseInt(response.associate_id, 10))
                            .update({
                                active: false
                            })
                            .transacting(trx);

                        // cria novo associado
                        const associateId = await modelsDb.Life.knex().insert({
                                beneficiary_id: parseInt(event.data.beneficiary_id, 10),
                                plan_id: finalPlanId,
                                company_id: event.data.company_id
                            }, 'id').into(`${event.db_schema}.associates`)
                            .transacting(trx);

                        // obtém o id do novo associado criado
                        finalAssociateId = parseInt(associateId[0], 10);
                    } else { // continua no mesmo plano
                        // obtém o id do associado inserido
                        finalAssociateId = parseInt(response.associate_id, 10);
                    }
                }

                // cria a pratica
                const practiceId = await modelsDb.Life.knex().insert({
                        associate_id: finalAssociateId,
                        service_id: finalServiceId,
                        occurrence_at: event.data.occurrence_at,
                        duration: event.data.duration
                    }, 'id').into(`${event.db_schema}.practice`)
                    .transacting(trx);

                // obtém o id da prática criada
                finalPracticeId = parseInt(practiceId[0], 10);

                return {
                    practiceId: finalPracticeId,
                    associatedId: finalAssociateId,
                    planId: finalPlanId,
                    serviceId: finalServiceId
                };
            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
        modelsDb.destroy();
    }





























    return response;
}

module.exports = {
    run
}
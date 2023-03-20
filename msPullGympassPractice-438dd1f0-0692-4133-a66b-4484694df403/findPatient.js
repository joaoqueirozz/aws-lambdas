const modelsDw = require('models');
const utils = require('utils');


function getOmopIdentifier(identifier) {
    if (!identifier) {
        return null;
    }

    const parts = identifier.split('/');
    const id = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id
            }
        }
        default: {
            return null;
        }
    }
}

async function run(event) {
    try {
        // inicializa model
        modelsDw.init(event.connection_params, event.dw_schema);

        // obtém identifier
        const response = getOmopIdentifier(event.identifier);

        if (!response) {
            throw utils.buildCustomError(400, 'Por favor, informe um CPF como filtro de pesquisa');
        }

        //monta a query
        let rawQuery = [];
        rawQuery.push('select ( ');
        rawQuery.push(`select b.id from ${event.dw_schema}.lives l `);
        rawQuery.push(`inner join ${event.dw_schema}.beneficiaries b `);
        rawQuery.push('on b.life_id = l.id ');
        rawQuery.push(`where l.${response.attr} = '${response.id}' `);
        rawQuery.push(') as beneficiary_id, ( ');
        rawQuery.push(`select c.id from ${event.dw_schema}.companies c `);
        rawQuery.push(`inner join ${event.dw_schema}.beneficiaries b `);
        rawQuery.push('on b.company_id  = c.id ');
        rawQuery.push(`inner join ${event.dw_schema}.lives l `);
        rawQuery.push('on l.id = b.life_id ');
        rawQuery.push(`where l.${response.attr} = '${response.id}' `);
        rawQuery.push(') as company_id;');
        rawQuery = rawQuery.join('');

        // executa a query 
        const patients = (await modelsDw.Life.knex().raw(rawQuery)).rows;

        if (patients && patients.length > 0) {
            if (!patients[0].beneficiary_id) {
                throw utils.buildCustomError(404, `Colaborador não encontrado - ${response.id}`);
            }

            if (!patients[0].company_id) {
                throw utils.buildCustomError(404, `Empresa não encontrada - colaborador ${response.id}`);
            }

            return patients[0];
        } else {
            throw utils.buildCustomError(500, 'Erro inesperado executando a query no servidor');
        }
    } catch (err) {
        throw err;
    } finally {
        modelsDw.destroy();
    }
}

module.exports = {
    run
}
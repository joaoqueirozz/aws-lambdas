function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cartao_sus': {
            return {
                attr: 'national_health_identification_number',
                id: document
            }
        }
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id: document
            }
        }
        case './NamingSystem/rg': {
            return {
                attr: 'document_identification_secondary',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, holder) {

    if (id) {
        const beneficiary = await models.Beneficiary.query()
            .where('id', id)

        if (beneficiary.length > 0) {
            return beneficiary[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        let rawQuery = [];
        rawQuery.push('select b.* ');
        rawQuery.push(`from ${schema}.beneficiaries b `);
        rawQuery.push(`inner join ${schema}.lives l `);
        rawQuery.push('on b.life_id = l.id ');
        rawQuery.push(`where l.${response.attr} = '${response.id}'`);
        rawQuery = rawQuery.join('');

        // executa a query 
        const beneficiaries = (await models.Beneficiary.knex().raw(rawQuery)).rows;

        if (beneficiaries && beneficiaries.length > 0) {
            return beneficiaries[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (holder) {
        let rawQuery = [];
        rawQuery.push('select b.* ');
        rawQuery.push(`from ${schema}.beneficiaries b `);
        rawQuery.push(`inner join ${schema}.lives l `);
        rawQuery.push('on b.life_id = l.id ');
        rawQuery.push(`where l.holder_id = ${parseInt(holder, 10)}`);
        rawQuery = rawQuery.join('');

        return (await models.Beneficiary.knex().raw(rawQuery)).rows || [];
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let beneficiaries;
        if (intSize) {
            beneficiaries = await await models.Beneficiary
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            beneficiaries = await models.Beneficiary
                .query()
                .orderBy('id');
        }

        return beneficiaries || [];
    }
}

module.exports = {
    execute
}
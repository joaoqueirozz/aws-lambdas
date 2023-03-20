function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cnpj': {
            return {
                attr: 'document_identification_primary',
                id: document,
                type: 'companies'
            }
        }
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id: document,
                type: 'lives'
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, organizationType, identifier, schema, page, size, queryParam) {
    if (id) {
        const contract = await models.Contract.query()
            .where('id', id)
            .withGraphFetched('[contracts_health_plans]');

        if (contract.length > 0) {
            console.log(contract[0]);
            return contract[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);
        let contract = [];

        if (response.type === 'companies') {
            contract = await models.Contract.query()
                .joinRelated(response.type)
                .where(`${response.type}.${response.attr}`, response.id)
                .withGraphFetched('[contracts_health_plans]');
        }
        else if (response.type === 'lives') {
            contract = await models.Contract.query()
                .joinRelated(`beneficiaries.[${response.type}]`)
                .where(`beneficiaries:${response.type}.${response.attr}`, response.id)
                .withGraphFetched('[contracts_health_plans]');
        }

        if (contract.length > 0) {
            return contract[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let contracts;
        if (intSize) {
            contracts = await models.Contract
                .query()
                .withGraphFetched('[contracts_health_plans]')
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            contracts = await models.Contract
                .query()
                .withGraphFetched('[contracts_health_plans]')
                .orderBy('id');
        }

        return contracts;
    }
}

module.exports = {
    execute
}
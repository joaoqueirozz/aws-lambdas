function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/payment_code': {
            return {
                attr: 'payment_code',
                id: document
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
   
    if (id) {
        const payments = await models.Payment.query()
            .where('id', id)

        if (payments.length > 0) {
            return payments[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        const payments = await models.Payment.query()
            .where(response.attr, response.id)

        if (payments.length > 0) {
            return payments[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let payments;
        if (intSize) {
            payments = await await models.Payment
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage);
        } else {
            payments = await models.Payment
                .query()
                .orderBy('id');
        }

        return payments || [];
    }
}

module.exports = {
    execute
}
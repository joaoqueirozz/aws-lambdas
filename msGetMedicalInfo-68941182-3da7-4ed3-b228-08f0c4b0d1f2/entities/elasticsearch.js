async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        // monta a query para buscar o id do grupo pelo documento
        let rawQuery = [];
        rawQuery.push('select cd.name, c.source_value as value, c.description ');
        rawQuery.push(`from ${schema}.concepts c `);
        rawQuery.push(`inner join ${schema}.concept_domains cd `);
        rawQuery.push('on c.domain_id = cd.id ');
        rawQuery.push(`where cd.structure_definition = '${id}'`);
        rawQuery = rawQuery.join('');

        // executa a query 
        const concepts = (await models.Life.knex().raw(rawQuery)).rows;

        if (concepts && concepts.length > 0) {
            return {
                title: concepts[0].name,
                dataset: concepts.map(item => {
                    return {
                        value: item.value,
                        description: item.description
                    }
                })
            };
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        throw utils.buildCustomError(400, 'Código da estrutura não informado');
    }
}

module.exports = {
    execute
}
async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        // monta a query para buscar o id do grupo pelo documento
        let rawQuery = [];
        rawQuery.push('select cd.name, cd.source, cd.custom, c.source_value as value, c.description ');
        rawQuery.push(`from ${schema}.concepts c `);
        rawQuery.push(`inner join ${schema}.concept_domains cd `);
        rawQuery.push('on c.domain_id = cd.id ');
        rawQuery.push(`where cd.value_set = '${id}'`);
        rawQuery = rawQuery.join('');

        // executa a query 
        const concepts = (await models.Life.knex().raw(rawQuery)).rows;

        if (concepts && concepts.length > 0) {
            return {
                "resourceType": "ValueSet",
                "id": id,
                "language": "pt-BR",
                "version": "1.0",
                "name": concepts[0].name,
                "status": "active",
                "experimental": false,
                "date": "2020-04-07T12:14:07.8417018+00:00",
                "publisher": "Sami",
                "immutable": false,
                "compose": {
                    "include": [{
                        "system": concepts[0].source || 'not available',
                        "version": "*",
                        "concept": concepts.map(item => {
                            return {
                                "code": item.value,
                                "display": item.description
                            };
                        })
                    }]
                }
            };


            // return {
            //     title: concepts[0].name,
            //     source: concepts[0].source,
            //     custom: concepts[0].custom,
            //     dataset: concepts.map(item => {
            //         return {
            //             value: item.value,
            //             description: item.description
            //         }
            //     })
            // };
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
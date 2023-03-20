async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        // monta a query para buscar o id do grupo pelo documento
        let rawQuery = [];
        rawQuery.push('select cd.name, cd.source, cd.custom, c.source_value as value, c.description ');
        rawQuery.push(`from ${schema}.concepts c `);
        rawQuery.push(`inner join ${schema}.concept_domains cd `);
        rawQuery.push('on c.domain_id = cd.id ');
        rawQuery.push(`where cd.structure_definition = '${id}'`);
        rawQuery = rawQuery.join('');

        // executa a query 
        const concepts = (await models.Life.knex().raw(rawQuery)).rows;

        if (concepts && concepts.length > 0) {
            return {
                "resourceType": "StructureDefinition",
                "meta": {
                    "lastUpdated": "2020-03-11T04:16:22.006+00:00"
                },
                "language": "pt-BR",
                "extension": [{
                        "url": "http://hl7.org/fhir/StructureDefinition/structuredefinition-wg",
                        "valueCode": "pc"
                    },
                    {
                        "url": "http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm",
                        "valueInteger": 1
                    }
                ],
                "url": "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRParentesIndividuo-1.0",
                "version": "1.0",
                "name": "BRParentesIndividuo",
                "title": "Parentes do Indivíduo",
                "status": "active",
                "date": "2020-03-11T04:16:19.3374511+00:00",
                "publisher": "Ministério da Saúde do Brasil",
                "description": "Resource para representar parentescos de indivíduo.",
                "fhirVersion": "4.0.0",
                "kind": "complex-type",
                "abstract": false,
                "context": [{
                    "type": "element",
                    "expression": "Patient"
                }],
                "type": "Extension",
                "baseDefinition": "http://hl7.org/fhir/StructureDefinition/Extension",
                "derivation": "constraint",
                "differential": {
                    "element": [{
                            "id": "Extension",
                            "path": "Extension",
                            "short": "Parentes do Indivíduo",
                            "definition": "Parentes de um indivíduo e seu grau de parentesco.",
                            "isModifier": false
                        },
                        {
                            "id": "Extension.extension",
                            "path": "Extension.extension",
                            "slicing": {
                                "discriminator": [{
                                    "type": "value",
                                    "path": "url"
                                }],
                                "rules": "open"
                            }
                        },
                        {
                            "id": "Extension.extension:relationship",
                            "path": "Extension.extension",
                            "sliceName": "relationship",
                            "short": "Parentesco",
                            "definition": "Distingue entre diferentes tipos de relações parentais com granularidade variável para apoiar a captura da relação no grau conhecido.",
                            "min": 1,
                            "max": "1",
                            "isModifier": false,
                            "binding": {
                                "strength": "required",
                                "description": "Parentesco",
                                "valueSet": "http://www.saude.gov.br/fhir/r4/ValueSet/BRParentesco-1.0"
                            }
                        },
                        {
                            "id": "Extension.extension:relationship.url",
                            "path": "Extension.extension.url",
                            "type": [{
                                "code": "uri"
                            }],
                            "fixedUri": "relationship"
                        },
                        {
                            "id": "Extension.extension:relationship.value[x]",
                            "path": "Extension.extension.value[x]",
                            "min": 1,
                            "type": [{
                                "code": "code"
                            }]
                        },
                        {
                            "id": "Extension.extension:parent",
                            "path": "Extension.extension",
                            "sliceName": "parent",
                            "short": "Parente do Indivíduo",
                            "definition": "Nome completo ou referência a outro indivíduo que tem parentesco com o indivíduo atual.",
                            "min": 1,
                            "max": "1",
                            "isModifier": false
                        },
                        {
                            "id": "Extension.extension:parent.url",
                            "path": "Extension.extension.url",
                            "type": [{
                                "code": "uri"
                            }],
                            "fixedUri": "parent"
                        },
                        {
                            "id": "Extension.extension:parent.value[x]",
                            "path": "Extension.extension.value[x]",
                            "min": 1,
                            "type": [{
                                    "code": "HumanName",
                                    "profile": [
                                        "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRNomeIndividuo-1.0"
                                    ]
                                },
                                {
                                    "code": "Reference",
                                    "targetProfile": [
                                        "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0"
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "Extension.url",
                            "path": "Extension.url",
                            "type": [{
                                "code": "uri"
                            }],
                            "fixedUri": "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRParentesIndividuo-1.0"
                        },
                        {
                            "id": "Extension.value[x]",
                            "path": "Extension.value[x]",
                            "max": "0"
                        }
                    ]
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
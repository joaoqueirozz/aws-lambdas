function unNest(care_team, mergeOptions, _) {
    const originalId = parseInt(care_team.id, 10);

    _.mergeWith(care_team, care_team.care_team_locations, mergeOptions);
    delete care_team.care_team_locations;

    care_team.practitioners = care_team.care_team_providers.map(item => {
        return { provider_id: parseInt(item.provider_id, 10) };
    });
    delete care_team.care_team_providers;

    care_team.id = originalId;
}

function getStage(env) {
    switch (env) {
        case 'dev': {
            return 'development';
        }
        case 'hml': {
            return 'staging';
        }
        case 'prd': {
            return 'production';
        }
    }
}

function getOmopIdentifier(identifier) {
    const parts = identifier.split('/');
    const document = parts.pop();
    const namespace = parts.join('/');

    switch (namespace) {
        case './NamingSystem/cpf': {
            return {
                attr: 'document_identification_primary',
                id: document,
                type: 'patient'
            }
        }
        case './NamingSystem/conselhoRegional': {
            return {
                attr: 'national_provider_identification',
                id: document,
                type: 'practitioner'
            }
        }
        case 'api-dev.samisaude.com.br':
        case 'api-staging.samisaude.com.br':
        case 'api.samisaude.com.br': {
            return {
                attr: 'careteam_app_id',
                id: document,
                type: 'appid'
            }
        }
        default:
            return {
                type: 'invalid'
            };
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    if (id) {
        const careTeams = await models.CareTeam
            .query()
            .where('id', id)
            .withGraphFetched('[care_team_locations, care_team_providers]');

        if (careTeams.length > 0) {
            unNest(careTeams[0], mergeOptions, _);
            return careTeams[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else if (identifier) {
        const response = getOmopIdentifier(identifier);

        if (response.type === 'patient') {
            // monta a query para buscar o id do grupo pelo documento
            let rawQuery = [];
            rawQuery.push('select ctl.id ');
            rawQuery.push(`from ${schema}.care_team_lives ctl `);
            rawQuery.push(`inner join ${schema}.lives l `);
            rawQuery.push('on ctl.life_id = l.id ');
            rawQuery.push(`where l.${response.attr} = '${response.id}'`);
            rawQuery = rawQuery.join('');

            // executa a query 
            const groups = (await models.CareTeam.knex().raw(rawQuery)).rows;

            if (groups && groups.length > 0) {
                const careTeams = await models.CareTeam
                    .query()
                    .where('care_team_lives_id', groups[0].id)
                    .withGraphFetched('[care_team_locations, care_team_providers]');

                if (careTeams && careTeams.length > 0) {
                    unNest(careTeams[0], mergeOptions, _);
                    return careTeams[0];
                } else {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        } else if (response.type === 'practitioner') {
            // monta a query para buscar o id do care team pelo médico
            let rawQuery = [];
            rawQuery.push('select ctp.care_team_id as id ');
            rawQuery.push(`from ${schema}.care_team_providers ctp `);
            rawQuery.push(`inner join ${schema}.providers p `);
            rawQuery.push('on ctp.provider_id = p.id ');
            rawQuery.push(`where p.${response.attr} = '${response.id}'`);
            rawQuery = rawQuery.join('');

            // executa a query 
            const careTeamIds = (await models.CareTeam.knex().raw(rawQuery)).rows;

            if (careTeamIds && careTeamIds.length > 0) {
                const careTeams = await models.CareTeam
                    .query()
                    .where('id', careTeamIds[0].id)
                    .withGraphFetched('[care_team_locations, care_team_providers]');

                if (careTeams && careTeams.length > 0) {
                    unNest(careTeams[0], mergeOptions, _);
                    return careTeams[0];
                } else {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        } else if (response.type === 'appid') {
            const careTeams = await models.CareTeam
                .query()
                .where(response.attr, response.id)
                .withGraphFetched('[care_team_locations, care_team_providers]');

            if (careTeams && careTeams.length > 0) {
                unNest(careTeams[0], mergeOptions, _);
                return careTeams[0];
            } else {
                throw utils.buildCustomError(404, 'Recurso não encontrado');
            }
        } else {
            throw utils.buildCustomError(400, 'NamingSystem inválido para essa requisição');
        }
    } else {
        const intPage = page && page.length > 0 ? parseInt(page, 10) : 0;
        const intSize = size && size.length > 0 ? parseInt(size, 10) : 0;

        let careteams;
        if (intSize) {
            careteams = await models.CareTeam
                .query()
                .orderBy('id')
                .limit(intSize)
                .offset(intSize * intPage)
                .withGraphFetched('[care_team_locations, care_team_providers]');
        } else {
            careteams = await models.CareTeam
                .query()
                .orderBy('id')
                .withGraphFetched('[care_team_locations, care_team_providers]');
        }

        for (let i = 0; i < careteams.length; i++) {
            unNest(careteams[i], mergeOptions, _);
        }

        return careteams;
    }
}

module.exports = {
    execute
}
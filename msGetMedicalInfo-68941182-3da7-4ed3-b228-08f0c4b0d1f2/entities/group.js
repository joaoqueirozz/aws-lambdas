function getConfig(models, type) {

    switch (type) {
        case 'person': {
            return { // 1
                tablenames: {
                    main: "care_team_lives"
                },
                model: models.CareTeamLives,
                type: 'ins'
            }
        }
        case 'site': {
            return { // 0
                tablenames: {
                    main: "health_plan_care_sites"
                },
                model: models.HealthPlanCareSites,
                type: 'site'
            }
        }
    }
}

function returnExecuteGroup(group, type) {

    switch (type) {
        case 'person': {
            const patients = group.map(item => {
                return { life_id: parseInt(item.life_id, 10) };
            });

            return {
                id: group[0].id,
                type: type,
                actual: true,
                patients
            }
        }
        case 'site': {
            const careSites = group.map(item => {
                return { care_site_id: parseInt(item.care_site_id, 10) };
            });

            return {
                id: group[0].id,
                type: type,
                actual: true,
                careSites
            }
        }
    }
}

async function execute(id, models, utils, mergeOptions, _, type, identifier, schema, page, size, queryParam) {
    const config = getConfig(models, type);

    if (id) {
        const group = await config.model.query()
            .where('id', id);

        if (group.length > 0) {
            return returnExecuteGroup(group, type)
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        throw utils.buildCustomError(400, 'Informe o id do recurso');
    }
}

module.exports = {
    execute
}
const { post, update, getByIdentifier } = require("../services/nodefetch");
const { getResourceIdentifier } = require("../const/utils");

module.exports.execute = async (
  env,
  entity,
  resource,
  newData,
  oldData,
  method
) => {
  await getCompanyAndContract(env, newData);

  let id = getBeneficiaryId(newData, oldData);

  newData["life_id"] = oldData ? Number(oldData.id) : null;

  await getHolder(env, newData);
  await getContractorType(newData);

  try {
    if (id && method != "post")
      verifyError(await update(env, resource, newData, id));
    else id = verifyError(await post(env, resource, newData));
  } catch (err) {
    throw err;
  }
};

async function getCompanyAndContract(env, newData) {
  const entity = getResourceIdentifier("company");

  if (newData["company_id"]) {
    let response = await getByIdentifier(
      env,
      entity.searchResource,
      entity.identifier,
      newData["company_id"]
    );

    if (response) {
      if (response.length > 0) {
        newData["company_id"] = Number(response[0]["id"]);

        if (response.contracts && response.contracts.length > 0)
          newData["contract_id"] = Number(response[0]["contracts"][0]["id"]);
      } else {
        newData["company_id"] = Number(response["id"]);

        if (response.contracts && response.contracts.length > 0)
          newData["contract_id"] = Number(response["contracts"][0]["id"]);
      }
    }
  }
}

async function getHolder(env, newData) {
  if (newData["holder_id"]) {
    const entity = getResourceIdentifier("life");

    let response = await getByIdentifier(
      env,
      entity.searchResource,
      entity.identifier,
      newData["holder_id"]
    );

    if (response) {
      if (response.beneficiaries.length > 0) {
        newData["holder_id"] = Number(response.beneficiaries[0].id) || null;
      } else if (response.beneficiaries) {
        newData["holder_id"] = Number(response.beneficiaries.id) || null;
      }
    }
  }
}

async function getContractorType(newData) {
  const contractorType = newData["contractor_type"];

  if (contractorType) {
    const propTypes = {
      employee: 1,
      partner: 2,
      dependent: 3,
    };

    newData["contractor_type"] = propTypes[contractorType]
      ? propTypes[contractorType]
      : null;
  }
}

function getBeneficiaryId(newData, oldData) {
  if (oldData && oldData.beneficiaries) {
    // const beneficiary = oldData.beneficiaries.find(
    //   (b) => b.company_id == newData.company_id
    // );

    // return beneficiary ? Number(beneficiary["id"]) : null;

    if (oldData.beneficiaries.length > 0) {
      return Number(oldData.beneficiaries.slice(-1)[0]["id"]);
    } else return Number(oldData.beneficiaries["id"]);
  }
}

function verifyError(response) {
  if (response && response.errorType) {
    throw JSON.parse(response.errorMessage);
  } else return response.id;
}

# importing the requests library 
import requests 
from requests.exceptions import HTTPError


def handler(event, context):
    # post_result = create_credentials(event['accountId'],
    #                                  event['credentials_name'],
    #                                  event['role_arn'],
    #                                  event['username'],
    #                                  event['password'])
    
    # post_result = create_storage_config(event['accountId'],
    #                                     event['storage_config_name'],
    #                                     event['s3bucket_name'],
    #                                     event['username'],
    #                                     event['password'])

    post_result = create_workspace(event['accountId'],
                                   event['workspace_name'],
                                   event['deployment_name'],
                                   event['aws_region'],
                                   event['credentials_id'],
                                   event['storage_config_id'],
                                   event['username'],
                                   event['password'])

    # get_result = get_workspace(event['accountId'],
    #                            event['workspace_id'],
    #                            event['username'],
    #                            event['password'])

# POST - create credentials
def create_credentials(account_id, credentials_name, role_arn, username, password):

    # api-endpoint
    URL = "https://accounts.cloud.databricks.com/api/2.0/accounts/"+account_id+"/credentials"
    
    # Json data
    DATA = {
        "credentials_name": credentials_name, 
        "aws_credentials": {
            "sts_role": {
                "role_arn": role_arn
            }
        }
    }

    response = post_request(URL, DATA, username, password)
    print(response)
    
    # parse response
    credentials_id = response['credentials_id']
    external_id = response['aws_credentials']['sts_role']['external_id']
    print('credentials_id - {}, external_id - {}'.format(credentials_id, external_id))

# POST - create storage configuration
def create_storage_config(account_id, storage_config_name, s3bucket_name, username, password):
    # api-endpoint
    URL = "https://accounts.cloud.databricks.com/api/2.0/accounts/"+account_id+"/storage-configurations"
    
    # Json data
    DATA = {
        "storage_configuration_name": storage_config_name,
        "root_bucket_info": {
            "bucket_name": s3bucket_name
        }
    }

    response = post_request(URL, DATA, username, password)
    print(response)
    
    # parse response
    storage_configuration_id = response['storage_configuration_id']
    print('storage_configuration_id - {}'.format(storage_configuration_id))

# POST - create workspace
def create_workspace(account_id, workspace_name, deployment_name, aws_region, credentials_id, storage_config_id, username, password):
    # api-endpoint
    URL = "https://accounts.cloud.databricks.com/api/2.0/accounts/"+account_id+"/workspaces"
    
    # Json data
    DATA = {
        "workspace_name": workspace_name, 
        "deployment_name": deployment_name, 
        "aws_region": aws_region, 
        "credentials_id": credentials_id, 
        "storage_configuration_id": storage_config_id
    }

    response = post_request(URL, DATA, username, password)
    print(response)
    
    # parse response
    workspace_id = response['workspace_id']
    workspace_status = response['workspace_status']
    workspace_status_message = response['workspace_status_message']
    print('workspace_id - {}, status - {}, message - {}'.format(workspace_id, workspace_status, workspace_status_message))
    
# GET - get workspace
def get_workspace(account_id, workspace_id, username, password):
    # api-endpoint
    URL = "https://accounts.cloud.databricks.com/api/2.0/accounts/"+account_id+"/workspaces/"+workspace_id

    response = get_request(URL, username, password)
    print(response)

    # parse response
    workspace_status = response['workspace_status']
    workspace_status_message = response['workspace_status_message']
    print('workspace status - {}, msg - {}'.format(workspace_status, workspace_status_message))
    

# POST request function
def post_request(url, json_data, username, password):
    try:
        # sending post request and saving the response as response object
        resp = requests.post(url, json=json_data, auth=(username, password))
        
        # extracting data in json format 
        data = resp.json() 
        
        # If the response was successful, no Exception will be raised
        resp.raise_for_status()
        
    except HTTPError as http_err:
        print(f'HTTP error occurred: {http_err}')
        print(f'HTTP content: {http_err.response.content}')
    except Exception as err:
        print(f'Other error occurred: {err}')
    else:
        print('Successful POST call!!')
        return data

# GET request function
def get_request(url, username, password):
    try:
        # sending get request and saving the response as response object 
        resp = requests.get(url = url, auth=(username, password)) 
        
        # extracting data in json format 
        data = resp.json() 
        
        # If the response was successful, no Exception will be raised
        resp.raise_for_status()
        
    except HTTPError as http_err:
        print(f'HTTP error occurred: {http_err}')
    except Exception as err:
        print(f'Other error occurred: {err}')
    else:
        print('Successful GET call!!')
        return data
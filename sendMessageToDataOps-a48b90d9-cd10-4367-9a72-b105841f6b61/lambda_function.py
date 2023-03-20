import urllib3 
import json
import base64
from textwrap import dedent
http = urllib3.PoolManager()

def lambda_handler(event, context): 
    url = base64.b64decode("aHR0cHM6Ly9ob29rcy5zbGFjay5jb20vc2VydmljZXMvVEdYQVEyM0NOL0IwMzFaTEFRRk5FL3k1WENlOUcxa3E0M1R6Y1djR1ZreG1Xaw==")
    url = url.decode("utf-8")
    sns_ret = json.loads(str(event['Records'][0]['Sns']['Message']))
    #print(sns_ret)
    message = ""
    if (str(sns_ret['source']) == "aws.codepipeline"):
        if(str(sns_ret['detailType'])=='CodePipeline Action Execution State Change'):
            message = dedent(f"""
                :bookmark: *Pipeline - Approval needed*
                *Pipeline name*: {sns_ret['detail']['pipeline']}
                *Time*: {sns_ret['time']}
            """)
        elif(str(sns_ret['detailType'])=='CodePipeline Pipeline Execution State Change'):
            message = dedent(f"""
                :alert: *Pipeline - Failed*
                *Pipeline name*: {sns_ret['detail']['pipeline']}
                *Time*: {sns_ret['time']}
                *Failed action*: {sns_ret['additionalAttributes']['failedActions'][0]['action']} -> {sns_ret['additionalAttributes']['failedActions'][0]['additionalInformation']}
            """)
    else:
        message = sns_ret
    msg = {
        "text": message
    }
    encoded_msg = json.dumps(msg).encode('utf-8')
    resp = http.request('POST',url, body=encoded_msg)
    print({
        "message": event['Records'][0]['Sns']['Message'], 
        "status_code": resp.status, 
        "response": resp.data
    })
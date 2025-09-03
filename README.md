#[DEPRECATED] finance-portal-backend-service
Deprecation Notice
Theis repo is deprecated as of September 2025. It is no longer maintained, and is no longer referenced by any releases of Mojaloop.

For general mojaloop documentation, please refer to [Mojaloop documentation](https://docs.mojaloop.io) .



# finance-portal-backend-service
[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/finance-portal-backend-service.svg?style=flat)](https://github.com/mojaloop/finance-portal-backend-service/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/finance-portal-backend-service.svg?style=flat)](https://github.com/mojaloop/finance-portal-backend-service/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/finance-portal-backend-service.svg?style=flat)](https://hub.docker.com/r/mojaloop/finance-portal-backend-service)
[![CircleCI](https://circleci.com/gh/mojaloop/finance-portal-backend-service.svg?style=svg)](https://circleci.com/gh/mojaloop/finance-portal-backend-service)

The backend service to support the admin portal web ui. Essentially a thin wrapper around SQL queries.

Run in development with `npm run dev`.

You can filter logs through `pino-pretty`, or another ndjson viewer such as `jq` to obtain
pretty-printed output. This also works with `kubectl log`.

## TODO
* Make sure app.env is 'production' in production.  See: https://koajs.com/ 'Settings' section.
* In development mode check for divergence between .env.template and .env and warn the user
* Bring api.json up to date
* Employ validation lib from golden dfsp in this backend to help prevent stored/reflected XSS
* Double-check all sensible escaping, including HTML and SQL escaping occurs wherever anything goes
    into the db, or is stored and later returned to the client
* Check all mandatory environment and secrets are present before beginning operation. Print a
    useful error message informing that operation cannot continue if they are not.

## External dependencies
This service relies on external APIs in order to perform some operations regarding Forex transactions and delegation of the "commit settlement window" action.

These APIs are not part of the Mojaloop core, and their specific implementations and usages are at the discretion of the target deployment.
Their endpoints are defined by these configuration values:
* FXP_ENDPOINT
* EXTERNAL_SETTLEMENTS_ENDPOINT

## Running locally
You'll need access to a mysql instance containing some central_ledger data, and a mojaloop deployment.

Copy the `.template.env` file to a `.env` file and change details as appropriate. Note the
`FXP_ENDPOINT`, `EXTERNAL_SETTLEMENTS_ENDPOINT`, `CENTRAL_SETTLEMENTS_ENDPOINT` and `CENTRAL_LEDGER_ENDPOINT` values. Then port forward the central ledger
and central settlements services as follows, replacing the ports 4000 and 4001 to correspond to the
values in the `.env` file, and replacing `$whatever` as appropriate for your deployment (you can
get these values either with tab-completion, or `kubectl get pods`):
```bash
kubectl port-forward mowbkd-centralledger-service-$whatever 4001:3001
kubectl port-forward mowbkd-centralsettlement-$whatever 4000:3007
cd ./src
npm install
node index.js
```

## TODO
* import golden dfsp validation lib for swagger validation of requests and responses
* import golden dfsp logging lib for structured logging

## ToLocal
## What does this do?
reverse proxies https requests from a public domain to your localhost, through an ssh tunnel.
for example:

https://api.dev.nelsonenzo.com -> localhost:4000

You own the domain, nginx config, and ssh tunnel. It's all yours.

### How does it do it?
tolocal is an npm cli that wraps terraform. 

The terraform creates:
- an ec2 with nginx
- a security group
- dns records

Use `tolocal config` and it will prompt you for all the necessary aws config variables.  
It queries your aws account as it goes, so it's super simple to select your vpc, public subnet, and dns hostzone.
## All Commands
```
tolocal config [--dev]
tolocal apply
sudo tolocal up
tolocal destroy
tolocal help
```
## Install
```
npm i -g tolocal
```
#### Get Started
```
tolocal config
```
the config command will
- prompt for aws info:
  - profile
  - region
  - vpc
  - PUBLIC subnet
  - route53 dns host zone
- prompt for subdomains=localport mappings
- prompt for your ssh public and private key file locations 
  - your public key goes on the ec2, your private key is used to start ssh tunnels.

#### Create the infrastructure in aws
```
tolocal create
```
#### Stand up the local ssh tunnels
This command requires sudo to automatically trust the ec2 instances 
```
sudo tolocal up
```
#### Destroy the infra
To stop paying for the t2.micro (~$8/mo when run 24/7*30) by destroying the infra.
```
tolocal destroy
```
#### Redeploy
You don't need to run config if nothing has changed.
```
tolocal create
## wait a few minutes for https to resolve....
sudo tolocal up
```

## What Get's created?
- t2.micro ec2 running nginx
- ec2 security group
- route53 dns records

## Does it create a host zone?
No, an existing route53 dns host zone is required.

## What about HTTP & HTTPS?
- http is redirected to https
- https is resolved with Lets Encrypt certbot on ec2 creation.


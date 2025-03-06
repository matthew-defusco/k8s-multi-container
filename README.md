# Some random notes about this project

<img width="899" alt="k8s_cluster_diagram" src="https://github.com/user-attachments/assets/833345cd-f44b-45cb-bbac-a9df0b31a576" />

## Postgres Persistent Volume Claim (PVC) Object

### What is a volume?

Generally speaking, a volume is a mechanism by which a container can access a filesystem outside of itself. You can use volumes if you want one part of a container to reference a specific part of a filesystem from a different container or filesystem.

### What's the issue with Postgres?

If a Postgres deployment that's created were to ever crash none of the data in that database would carry over to the new pod that is automatically recreated by the deployment.

That data is saved into the filesystem that is created within the container so when the container gets recreated, the filesystem doesn't have the previously stored data.

To make sure that we can retain data in the event of a recreated deployment/pod, we have to write the data to a volume instead of to the filesystem. The Postgres pod will reference the data within the volume instead of it's internal filesystem instead.

**Important Note**: If you have multiple replicas of Postgres referencing the same PVC, that will cause issues. So it is important that there is only 1 replica of Postgres running and referencing the volume.

### The term "Volume" in the world of Kubernetes

There are 3 different types of Volumes in Kubernetes. Each of them are separate objects that can be created.

- Volume
  - An object that allows a container to store data at the pod level. The downside to using a typical Volume object in the Kubernetes world is that the Volume is tied to the pod. So if a container within a pod crashes and gets recreated, that's OK because it's recreated within the pod and would have access to the Volume that is also tied to and contained within the pod. However, if the **pod itself** were to die and get recreated, the volume would also get recreated and the data would not persist.
- Persistent Volume
  - An object that is created separate from the pod. If a pod crashes and gets recreated, it can reference the Persistent Volume that did not crash with the pod.
- Persistent Volume Claim
  - An object that can be created that lists the different Persistent Volumes that should available to a given pod. This PVC is then referenced in the pod configuration and when the pod needs a Persistent Volume it will request one of the options from the PVC. Kubernetes will then either pull from an existing data store that was configured beforehand or it will dynamically provision one as needed.

### How to use a PVC

Once a PVC object config has been defined, it needs to be "attached" to an existing pod configuration file. This will then allow that pod to go look for a data storage resource as defined in the PVC config and either provision one that exists already or create one on the spot.

First you define that you want to allocate storage using the PVC and then you need to actually assign if for use with the containers inside the pod. The "template -> spec -> volumes" section of the config is for the allocation and the "template -> spec -> containers -> volumeMounts" is for assigning it to the containers.

The "mountPath" field is used to designate where inside the container the storage should be made available. This is the directory in the filesystem that should actually reference the Persistent Volume that was created based on the PVC.

## Managing secret values in Kubernetes

To create secret values that will only be available to running containers within your cluster, you can create a Secret object.

One of these is used to store the Postgres password in this demo app.

Secrets are created by running an imperative command so that Kubernetes can handle the encryption of the actual value you're trying to keep secret.

`kubectl create secret generic <secret_name> --from-literal key=value`

Once the secret is created, you wire it up to the Deployment(s) that needs access to it. In our case, the postgres deployment needs it to override the default password that is set and the server deployment needs it to connect to the postgres instance (the code that's written in our express app).

```yaml
valueFrom:
  secretKeyRef:
    name: secret name
    key: secret key
```

The name value above is the name that was given to the secret and the key value is the key in the key/value pair that was defined in the secret (since multiple key/value pairs can be defined for a given secret).

## Networking with Ingress Controllers

### What is an Ingress Service?

Exposes a set of services to the outside world. From a configuration file, a pod is generated that creates an Ingress Controller which will generate some infrastructure (Nginx) that accepts incoming traffic to the Node and directs it appropriately.

### How this service works in our project

The Ingress Service will ultimately also generate a Google Cloud Load Balancer in production and a corresponding Load Balancer Service. That will then get traffic into the nginx pod that was generated by the Ingress Service and forward it along to the correct Cluster IP Service that should handle the request.

The rules in the ingress-service file specify two different things:

- If traffic comes in that ends in just "/" then forward that along to the client-cluster-ip-service to handle.
- If traffic comes in that ends in "/api" then forward it to the server-cluster-ip-service.
  - In addition, in the annotations section, there is a declaration to "rewrite-target" which means that the path of request that comes in should be rewritten when it gets to it's target. This would be changing the request from "/api" to just "/".

## Using HTTPS instead of HTTP

### Getting a certification from LetsEncrypt

Would need to make a request to the LE API for them to verify that we own the website. Once they validate that, they will respond with a certificate.

This connection and process can be facilitated using a Helm package called Cert Manager. Cert Manager will create a pod that has route handlers that are able to deal with the incoming LE requests and reconfigure things in the pod as needed when it receives the certificate.

In order to set up Cert Manager to request the certificate from LE and then to handle the inbound requests the way we want and configure the rest of the cluster with the certificate, two new objects needed to be created:

1. Certificate
   1. Information that has the details of the TLS certficate.
   2. Will ultimately create a Kubernetes Secret that will hold the certificate.
2. Issuer
   1. A config file that tells the cert manager how to reach out to a certificate authority and obtain a certificate.
   2. Tells Cert Manager which certificate authority to reach out to and in which environment (staging, prod, etc.)

In addition, the Ingress needs to be updated to serve up HTTPS traffic and to know where to look for the Secret that houses the TLS certificate.

### Quick Notes

There are different implementations of an Ingress but this project uses specifically an Nginx Ingress (ingress-nginx NOT kubernetes-ingress).

The setup for ingress-nginx is different depending on the cloud provider that you choose. This project is deployed on Google Cloud so it will use that configuration.

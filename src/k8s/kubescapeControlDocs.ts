/**
 * What each Kubescape control checks, how it is tested and how to fix it, for
 * the control detail panel on the Compliance page.
 *
 * Generated from the kubescape/regolibrary v2 release
 * (https://github.com/kubescape/regolibrary/releases/tag/v2), the `controls`
 * file: description, test, remediation and references, for the controls
 * kubescapeFrameworks.ts lists. Kept in its own file so the framework
 * definitions stay readable. Regenerate it together with kubescapeFrameworks.ts
 * when the operator moves to a new rule-library release.
 */

export interface KubescapeControlDoc {
  /** What the control checks and why it matters. */
  description?: string;
  /** How to fix a failing resource. */
  remediation?: string;
  /** How Kubescape tests it. */
  test?: string;
  /** Further reading, usually URLs. */
  references?: string[];
}

export const KUBESCAPE_CONTROL_DOCS: Record<string, KubescapeControlDoc> = {
  'C-0002': {
    description:
      'Attackers with relevant permissions can run malicious commands in the context of legitimate containers in the cluster using “kubectl exec” command. This control determines which subjects have permissions to use this command.',
    remediation:
      'It is recommended to prohibit “kubectl exec” command in production environments. It is also recommended not to use subjects with this permission for daily cluster operations.',
    test: 'Check which subjects have RBAC permissions to exec into pods– if they have the “pods/exec” verb.',
  },
  'C-0005': {
    description:
      'Kubernetes control plane API is running with non-secure port enabled which allows attackers to gain unprotected access to the cluster.',
    remediation: 'Set the insecure-port flag of the API server to zero.',
    test: 'Check if the insecure-port flag is set (in case of cloud vendor hosted Kubernetes service this verification will not be effective).',
  },
  'C-0007': {
    description:
      'Attackers may attempt to destroy data and resources in the cluster. This includes deleting deployments, configurations, storage, and compute resources. This control identifies all subjects that can delete resources.',
    remediation:
      'You should follow the least privilege principle and minimize the number of subjects that can delete resources.',
    test: 'Check which subjects have delete/deletecollection RBAC permissions on workloads.',
  },
  'C-0012': {
    description:
      'Attackers who have access to configuration files can steal the stored secrets and use them. This control checks if ConfigMaps or pod specifications have sensitive information in their configuration.',
    remediation: 'Use Kubernetes secrets or Key Management Systems to store credentials.',
    test: 'Check if the pod has sensitive information in environment variables, by using list of known sensitive key names. Check if there are configmaps with sensitive information.',
  },
  'C-0013': {
    description:
      'Potential attackers may gain access to a container and leverage its existing privileges to conduct an attack. Therefore, it is not recommended to deploy containers with root privileges unless it is absolutely necessary. This control identifies all the pods running as root or can escalate to root.',
    remediation:
      'If your application does not need root privileges, make sure to define runAsNonRoot as true or explicitly set the runAsUser using ID 1000 or higher under the PodSecurityContext or container securityContext. In addition, set an explicit value for runAsGroup using ID 1000 or higher.',
    test: 'Verify that runAsUser is set to a user id greater than 0 or that runAsNonRoot is set to true, and that runAsGroup is set to an id greater than 0. Check all the combinations with PodSecurityContext and SecurityContext (for containers).',
  },
  'C-0014': {
    description:
      'Attackers who gain access to the dashboard service account or have its RBAC permissions can use its network access to retrieve information about resources in the cluster or change them. This control checks if a subject that is not dashboard service account is bound to dashboard role/clusterrole, or - if anyone that is not the dashboard pod is associated with dashboard service account.',
    remediation:
      'Make sure that the “Kubernetes Dashboard” service account is only bound to the Kubernetes dashboard following the least privilege principle.',
    test: 'Check who is associated with the dashboard service account or bound to dashboard role/clusterrole.',
  },
  'C-0015': {
    description:
      'Attackers who have permissions to access secrets can access sensitive information that might include credentials to various services. This control determines which user, group or service account can list/get secrets.',
    remediation:
      'Monitor and approve list of users, groups and service accounts that can access secrets. Use exception mechanism to prevent repetitive the notifications.',
    test: 'Alerting on users  which have get/list/watch RBAC permissions on secrets.',
  },
  'C-0016': {
    description:
      'Attackers may gain access to a container and uplift its privilege to enable excessive capabilities.',
    remediation:
      'If your application does not need it, make sure the allowPrivilegeEscalation field of the securityContext is set to false.',
    test: 'Check that the allowPrivilegeEscalation field in securityContext of container is set to false.',
  },
  'C-0017': {
    description:
      'Mutable container filesystem can be abused to inject malicious code or data into containers. Use immutable (read-only) filesystem to limit potential attacks.',
    remediation:
      'Set the filesystem of the container to read-only when possible (pod securityContext, readOnlyRootFilesystem: true). If containers application needs to write into the filesystem, it is recommended to mount secondary filesystems for specific directories where application require write access.',
    test: 'Check whether the readOnlyRootFilesystem field in the SecurityContext is set to true.',
  },
  'C-0020': {
    description:
      'When a cluster is deployed in the cloud, in some cases attackers can leverage their access to a container in the cluster to gain cloud credentials. This control determines if any workload contains a volume with potential access to cloud credential.',
    remediation: 'Refrain from using path mount to known cloud credentials folders or files .',
    test: 'Check which workloads have volumes with potential access to known cloud credentials folders or files in node, like “/etc/kubernetes/azure.json” for Azure.',
  },
  'C-0021': {
    description:
      'Exposing a sensitive interface to the internet poses a security risk. It might enable attackers to run malicious code or deploy containers in the cluster. This control checks if known components (e.g. Kubeflow, Argo Workflows, AI/ML inference servers such as Ollama, vLLM, KServe and Triton, or MLOps interfaces such as MLflow, Ray and JupyterHub) are deployed and exposed services externally.',
    remediation:
      'Consider blocking external interfaces or protect them with appropriate security tools.',
    test: 'Checking if a service of type nodeport/loadbalancer to one of the known exploited interfaces (Apache NiFi, Kubeflow, Argo Workflows, Weave Scope Kubernetes dashboard) exists. Needs to add user config',
  },
  'C-0026': {
    description:
      'Attackers may use Kubernetes CronJob for scheduling execution of malicious code that would run as a pod in the cluster. This control lists all the CronJobs that exist in the cluster for the user to approve.',
    remediation: 'Watch Kubernetes CronJobs and make sure they are legitimate.',
    test: 'We list all CronJobs that exist in cluster for the user to approve.',
  },
  'C-0030': {
    description:
      'Disable Ingress and Egress traffic on all pods wherever possible. It is recommended to define restrictive network policy on all new pods, and then enable sources/destinations that this pod must communicate with.',
    remediation:
      'Define a NetworkPolicy, CiliumNetworkPolicy, or CiliumClusterwideNetworkPolicy that restricts ingress and egress connections.',
    test: 'Check for each Pod whether there is an ingress and egress policy defined via NetworkPolicy, CiliumNetworkPolicy, or CiliumClusterwideNetworkPolicy (whether using Pod or Namespace).',
  },
  'C-0031': {
    description:
      'Attackers may delete Kubernetes events to avoid detection of their activity in the cluster. This control identifies all the subjects that can delete Kubernetes events.',
    remediation:
      'You should follow the least privilege principle. Minimize the number of subjects who can delete Kubernetes events. Avoid using these subjects in the daily operations.',
    test: 'List who has delete/deletecollection RBAC permissions on events.',
  },
  'C-0034': {
    description:
      'Potential attacker may gain access to a pod and steal its service account token. Therefore, it is recommended to disable automatic mapping of the service account tokens in service account configuration and enable it only for pods that need to use them.',
    remediation:
      'Disable automatic mounting of service account tokens to pods either at the service account level or at the individual pod level, by specifying the automountServiceAccountToken: false. Note that pod level takes precedence.',
    test: "Check all service accounts on which automount is not disabled.  Check all workloads on which they and their service account don't disable automount",
  },
  'C-0035': {
    description:
      'Attackers who have cluster admin permissions (can perform any action on any resource), can take advantage of their privileges for malicious activities. This control determines which subjects have cluster admin permissions.',
    remediation:
      "You should apply least privilege principle. Make sure cluster admin permissions are granted only when it is absolutely necessary. Don't use subjects with such high permissions for daily operations.",
    test: 'Check which subjects have cluster-admin RBAC permissions – either by being bound to the cluster-admin clusterrole, or by having equivalent high privileges.',
  },
  'C-0036': {
    description:
      'Attackers can use validating webhooks to intercept and discover all the resources in the cluster. This control lists all the validating webhook configurations that must be verified.',
    remediation:
      'Ensure all the webhooks are necessary. Use exception mechanism to prevent repititive notifications.',
  },
  'C-0037': {
    description:
      "If attackers have permissions to modify the coredns ConfigMap they can change the behavior of the cluster’s DNS, poison it, and override the network identity of other services. This control identifies all subjects allowed to update the 'coredns' configmap.",
    remediation:
      "You should follow the least privilege principle. Monitor and approve all the subjects allowed to modify the 'coredns' configmap. It is also recommended to remove this permission from the users/service accounts used in the daily operations.",
    test: 'Check who has update/patch RBAC permissions on ‘coredns’ configmaps, or to all configmaps.',
  },
  'C-0038': {
    description:
      'Containers should be isolated from the host machine as much as possible. The hostPID and hostIPC fields in deployment yaml may allow cross-container influence and may expose the host itself to potentially malicious or destructive actions. This control identifies all pods using hostPID or hostIPC privileges.',
    remediation:
      'Remove hostPID and hostIPC from the yaml file(s) privileges unless they are absolutely necessary.',
  },
  'C-0039': {
    description:
      'Attackers may use mutating webhooks to intercept and modify all the resources in the cluster. This control lists all mutating webhook configurations that must be verified.',
    remediation:
      'Ensure all the webhooks are necessary. Use exception mechanism to prevent repititive notifications.',
  },
  'C-0041': {
    description:
      'Potential attackers may gain access to a pod and inherit access to the entire host network. For example, in AWS case, they will have access to the entire VPC. This control identifies all the pods with host network access enabled.',
    remediation:
      'Only connect pods to host network when it is necessary. If not, set the hostNetwork field of the pod spec to false, or completely remove it (false is the default). Whitelist only those pods that must have access to host network by design.',
  },
  'C-0042': {
    description:
      'An SSH server that is running inside a container may be used by attackers to get remote access to the container. This control checks if pods have an open SSH port (22/2222).',
    remediation:
      'Remove SSH from the container image or limit the access to the SSH server using network policies.',
    test: 'Check if service connected to some workload has an SSH port (22/2222). If so we raise an alert.',
  },
  'C-0044': {
    description:
      'Configuring hostPort requires a particular port number. If two objects specify the same HostPort, they could not be deployed to the same node. It may prevent the second object from starting, even if Kubernetes will try reschedule it on another node, provided there are available nodes with sufficient amount of resources. Also, if the number of replicas of such workload is higher than the number of nodes, the deployment will consistently fail.',
    remediation:
      'Avoid usage of hostPort unless it is absolutely necessary, in which case define appropriate exception. Use NodePort / ClusterIP instead.',
    test: 'Check for each workload (with container) if it exists inside the container hostPort.',
  },
  'C-0045': {
    description:
      'Mounting host directory to the container can be used by attackers to get access to the underlying host and gain persistence.',
    remediation:
      'Refrain from using the hostPath mount or use the exception mechanism to remove unnecessary notifications.',
    test: 'Checking in Pod spec if there is a hostPath volume, if it has the section mount.readOnly == false (or doesn’t exist) we raise an alert.',
  },
  'C-0046': {
    description:
      'Giving insecure or excessive capabilities to a container can increase the impact of the container compromise. This control identifies all the pods with dangerous capabilities (see documentation pages for details).',
    remediation: 'Remove all insecure capabilities which are not necessary for the container.',
    test: 'Check capabilities given against a configurable blacklist of insecure capabilities (https://man7.org/linux/man-pages/man7/capabilities.7.html).',
  },
  'C-0048': {
    description:
      'Mounting host directory to the container can be used by attackers to get access to the underlying host. This control identifies all the pods using hostPath mount.',
    remediation:
      'Remove hostPath mounts unless they are absolutely necessary and use exception mechanism to remove notifications.',
  },
  'C-0049': {
    description:
      'If no network policy is defined, attackers who gain access to a single container may use it to probe the network. This control lists all namespaces in which no network policies (NetworkPolicy, CiliumNetworkPolicy, or qualifying CiliumClusterwideNetworkPolicy) are defined.',
    remediation:
      'Define NetworkPolicy, CiliumNetworkPolicy, or CiliumClusterwideNetworkPolicy resources, or use similar network protection mechanisms.',
    test: 'Check for each namespace if there is a network policy defined (NetworkPolicy, CiliumNetworkPolicy, or qualifying CiliumClusterwideNetworkPolicy).',
  },
  'C-0052': {
    description:
      'Attackers who gain access to a container, may query the metadata API service for getting information about the underlying node. This control checks if there is access from the nodes to cloud providers instance metadata services.',
    remediation: 'Disable metadata services for pods in cloud provider settings.',
    test: 'Check which nodes have access to instance metadata services. The check is for AWS, GCP and Azure.',
  },
  'C-0053': {
    description:
      'Attackers who obtain access to a pod can use its SA token to communicate with KubeAPI server. All pods with SA token mounted (if such token has a Role or a ClusterRole binding) are considerred potentially dangerous.',
    remediation:
      'Verify that RBAC is enabled. Follow the least privilege principle and ensure that only necessary pods have SA token mounted into them.',
    test: "Control checks if RBAC is enabled. If it's not, the SA has unlimited permissions. If RBAC is enabled, it lists  all permissions for each SA.",
  },
  'C-0054': {
    description:
      'If no network policy is defined, attackers who gain access to a container may use it to move laterally in the cluster. This control lists namespaces in which no network policy (NetworkPolicy, CiliumNetworkPolicy, or qualifying CiliumClusterwideNetworkPolicy) is defined.',
    remediation:
      'Define Kubernetes NetworkPolicy, CiliumNetworkPolicy, or CiliumClusterwideNetworkPolicy resources to protect cluster network.',
    test: 'Check for each namespace if there is a network policy defined (NetworkPolicy, CiliumNetworkPolicy, or qualifying CiliumClusterwideNetworkPolicy).',
  },
  'C-0055': {
    description:
      'Containers may be given more privileges than they actually need. This can increase the potential impact of a container compromise.',
    remediation:
      'You can use AppArmor, Seccomp, SELinux and Linux Capabilities mechanisms to restrict containers abilities to utilize unwanted privileges.',
    test: 'Check if there is AppArmor or Seccomp or SELinux or Capabilities are defined in the securityContext of container and pod. If none of these fields are defined for both the container and pod, alert.',
  },
  'C-0057': {
    description:
      'Potential attackers may gain access to privileged containers and inherit access to the host resources. Therefore, it is not recommended to deploy privileged containers unless it is absolutely necessary. This control identifies all the privileged Pods.',
    remediation:
      'Remove privileged capabilities by setting the securityContext.privileged to false. If you must deploy a Pod as privileged, add other restriction to it, such as network policy, Seccomp etc and still remove all unnecessary capabilities. Use the exception mechanism to remove unnecessary notifications.',
    test: 'Check in Pod spec if securityContext.privileged == true, if so raise an alert.',
  },
  'C-0058': {
    description:
      'A user may be able to create a container with subPath or subPathExpr volume mounts to access files & directories anywhere on the host filesystem. Following Kubernetes versions are affected: v1.22.0 - v1.22.1, v1.21.0 - v1.21.4, v1.20.0 - v1.20.10, version v1.19.14 and lower. This control checks the vulnerable versions and the actual usage of the subPath feature in all Pods in the cluster. If you want to learn more about the CVE, please refer to the CVE link: https://nvd.nist.gov/vuln/detail/CVE-2021-25741',
    remediation:
      'To mitigate this vulnerability without upgrading kubelet, you can disable the VolumeSubpath feature gate on kubelet and kube-apiserver, or remove any existing Pods using subPath or subPathExpr feature.',
  },
  'C-0059': {
    description:
      'Security issue in ingress-nginx where a user that can create or update ingress objects can use the custom snippets feature to obtain all secrets in the cluster (see more at https://github.com/kubernetes/ingress-nginx/issues/7837)',
    remediation:
      'To mitigate this vulnerability: 1. Upgrade to a version that allows mitigation (>= v0.49.1 or >= v1.0.1), 2. Set allow-snippet-annotations to false in your ingress-nginx ConfigMap based on how you deploy ingress-nginx',
    test: 'The control checks if the nginx-ingress-controller contains the ability to disable allowSnippetAnnotations and that indeed this feature is turned off',
  },
  'C-0061': {
    description:
      'It is recommended to avoid running pods in cluster without explicit namespace assignment. This control identifies all the pods running in the default namespace.',
    remediation: 'Create necessary namespaces and move all the pods from default namespace there.',
    test: "Check that there are no pods in the 'default' namespace",
  },
  'C-0062': {
    description:
      'Adding sudo to a container entry point command may escalate process privileges and allow access to forbidden resources. This control checks all the entry point commands in all containers in the pod to find those that have sudo command.',
    remediation:
      'Remove sudo from the command line and use Kubernetes native root and capabilities controls to provide necessary privileges where they are required.',
    test: "Check that there is no 'sudo' in the container entrypoint",
  },
  'C-0063': {
    description:
      'Attackers with relevant RBAC permission can use “kubectl portforward” command to establish direct communication with pods from within the cluster or even remotely. Such communication will most likely bypass existing security measures in the cluster. This control determines which subjects have permissions to use this command.',
    remediation:
      'It is recommended to prohibit “kubectl portforward” command in production environments. It is also recommended not to use subjects with this permission for daily cluster operations.',
    test: 'Check which subjects have RBAC permissions to portforward into pods– if they have the “pods/portforward” resource.',
  },
  'C-0065': {
    description:
      'Impersonation is an explicit RBAC permission to use other roles rather than the one assigned to a user, group or service account. This is sometimes needed for testing purposes. However, it is highly recommended not to use this capability in the production environments for daily operations. This control identifies all subjects whose roles include impersonate verb.',
    remediation:
      'Either remove the impersonate verb from the role where it was found or make sure that this role is not bound to users, groups or service accounts used for ongoing cluster operations. If necessary, bind this role to a subject only for specific needs for limited time period.',
    test: "Check for RBACs giving 'impersonate' verb to users/groups/uids/serviceaccounts",
  },
  'C-0066': {
    description:
      'All Kubernetes Secrets are stored primarily in etcd therefore it is important to encrypt it.',
    remediation:
      'Turn on the etcd encryption in your cluster, for more see the vendor documentation.',
    test: 'Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if etcd encryption is enabled',
  },
  'C-0067': {
    description:
      'Audit logging is an important security feature in Kubernetes, it enables the operator to track requests to the cluster. It is important to use it so the operator has a record of events happened in Kubernetes',
    remediation:
      'Turn on audit logging for your cluster. Look at the vendor guidelines for more details',
    test: 'Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if audit logging is enabled',
  },
  'C-0068': {
    description:
      'PSP enable fine-grained authorization of pod creation and it is important to enable it',
    remediation:
      'Turn Pod Security Policies on in your cluster, if you use other admission controllers to control the behavior that PSP controls, exclude this control from your scans',
    test: 'Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if PSP is enabled',
  },
  'C-0069': {
    description:
      "By default, requests to the kubelet's HTTPS endpoint that are not rejected by other configured authentication methods are treated as anonymous requests, and given a username of system:anonymous and a group of system:unauthenticated.",
    remediation: 'Start the kubelet with the --anonymous-auth=false flag.',
    test: 'Reading the kubelet command lines and configuration file looking for anonymous-auth configuration. If this configuration is set on both, the command line values take precedence over it.',
  },
  'C-0070': {
    description:
      'Kubelets are the node level orchestrator in Kubernetes control plane. They are publishing service port 10250 where they accept commands from API server. Operator must make sure that only API server is allowed to submit commands to Kubelet. This is done through client certificate verification, must configure Kubelet with client CA file to use for this purpose.',
    remediation:
      'Start the kubelet with the --client-ca-file flag, providing a CA bundle to verify client certificates with.',
    test: 'Reading the kubelet command lines and configuration file looking for client TLS configuration.',
  },
  'C-0078': {
    description:
      'This control is intended to ensure that all the used container images are taken from the authorized repositories. It allows user to list all the approved repositories and will fail all the images taken from any repository outside of this list.',
    remediation: 'You should enable all trusted repositories in the parameters of this control.',
    test: 'Checks if image is from allowed listed registry.',
  },
  'C-0079': {
    description:
      'CVE-2022-0185 is a kernel vulnerability enabling privilege escalation and it can lead attackers to escape containers and take control over nodes. This control alerts on vulnerable kernel versions of Kubernetes nodes',
    remediation: 'Patch Linux kernel version to 5.16.2 or above',
    test: 'Checking Linux kernel version of the Node objects, if it is above 5.1 or below 5.16.2 it fires an alert',
  },
  'C-0081': {
    description:
      'CVE-2022-24348 is a major software supply chain 0-day vulnerability in the popular open source CD platform Argo CD which can lead to privilege escalation and information disclosure.',
    remediation: 'Update your ArgoCD deployment to fixed versions (v2.1.9,v2.2.4 or v2.3.0)',
    test: 'Checking Linux kernel version of the Node objects, if it is above 5.1 or below 5.16.2 it fires an alert',
  },
  'C-0087': {
    description:
      'CVE-2022-23648 is a vulnerability of containerd enabling attacker to gain access to read-only copies of arbitrary files from the host using specially-crafted manifests',
    remediation: 'Patch containerd to 1.6.1, 1.5.10, 1.4.12  or above',
    test: 'Checking containerd version to see if it is a vulnerable version (where the container runtime is containerd)',
  },
  'C-0089': {
    description:
      "The API server allows an aggregated API to redirect client traffic to any URL. This could lead to the client performing unexpected actions as well as forwarding the client's API server credentials to third parties",
    remediation:
      'Upgrade the Kubernetes version to one of the following versions (or higher patchs): `v1.25.1`, `v1.24.5`, `v1.23.11`, `v1.22.14`',
    test: 'List the aggregated-API-server services that could potentially be used to redirect client traffic to any URL, if the API server version is vulnerable to CVE-2022-3172',
  },
  'C-0091': {
    description:
      'CVE-2022-47633 is a high severity vulnerability in Kyverno, it enables attackers to bypass the image signature validation of policies using a malicious image repository or MITM proxy',
    remediation: 'Update your Grafana to 9.2.4 or above',
    test: 'This control test for vulnerable versions of Grafana (between 1.8.3 and 1.8.4)',
  },
  'C-0092': {
    description:
      'Ensure that the API server pod specification file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838561'],
  },
  'C-0093': {
    description:
      'Ensure that the API server pod specification file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838563'],
  },
  'C-0094': {
    description:
      'Ensure that the controller manager pod specification file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838564'],
  },
  'C-0095': {
    description:
      'Ensure that the controller manager pod specification file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838566'],
  },
  'C-0096': {
    description:
      'Ensure that the scheduler pod specification file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838568'],
  },
  'C-0097': {
    description:
      'Ensure that the scheduler pod specification file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838570'],
  },
  'C-0098': {
    description:
      'Ensure that the `/etc/kubernetes/manifests/etcd.yaml` file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/etcd.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838571'],
  },
  'C-0099': {
    description:
      'Ensure that the `/etc/kubernetes/manifests/etcd.yaml` file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/etcd.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838573'],
  },
  'C-0100': {
    description:
      'Ensure that the Container Network Interface files have permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 <path/to/cni/files>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838574'],
  },
  'C-0101': {
    description:
      'Ensure that the Container Network Interface files have ownership set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root <path/to/cni/files>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838576'],
  },
  'C-0102': {
    description:
      'Ensure that the etcd data directory has permissions of `700` or more restrictive.',
    remediation:
      'On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nchmod 700 /var/lib/etcd\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838577'],
  },
  'C-0103': {
    description: 'Ensure that the etcd data directory ownership is set to `etcd:etcd`.',
    remediation:
      'On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nchown etcd:etcd /var/lib/etcd\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838579'],
  },
  'C-0104': {
    description: 'Ensure that the `admin.conf` file has permissions of `600`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/admin.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838580'],
  },
  'C-0105': {
    description: 'Ensure that the `admin.conf` file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/admin.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838584'],
  },
  'C-0106': {
    description:
      'Ensure that the `scheduler.conf` file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/scheduler.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838586'],
  },
  'C-0107': {
    description: 'Ensure that the `scheduler.conf` file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/scheduler.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838587'],
  },
  'C-0108': {
    description:
      'Ensure that the `controller-manager.conf` file has permissions of 600 or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/controller-manager.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838593'],
  },
  'C-0109': {
    description: 'Ensure that the `controller-manager.conf` file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/controller-manager.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838599'],
  },
  'C-0110': {
    description:
      'Ensure that the Kubernetes PKI directory and file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown -R root:root /etc/kubernetes/pki/\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838604'],
  },
  'C-0111': {
    description:
      'Ensure that Kubernetes PKI certificate files have permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod -R 600 /etc/kubernetes/pki/*.crt\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838606'],
  },
  'C-0112': {
    description: 'Ensure that Kubernetes PKI key files have permissions of `600`.',
    remediation:
      'Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod -R 600 /etc/kubernetes/pki/*.key\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126653/recommendations/1838608'],
  },
  'C-0113': {
    description: 'Disable anonymous requests to the API server.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--anonymous-auth=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838609'],
  },
  'C-0114': {
    description: 'Do not use token based authentication.',
    remediation:
      'Follow the documentation and configure alternate mechanisms for authentication. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and remove the `--token-auth-file=<filename>` parameter.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838611'],
  },
  'C-0116': {
    description: 'Enable certificate based kubelet authentication.',
    remediation:
      'Follow the Kubernetes documentation and set up the TLS connection between the apiserver and kubelets. Then, edit API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the kubelet client certificate and key parameters as below.\n\n \n```\n--kubelet-client-certificate=<path/to/client-certificate-file>\n--kubelet-client-key=<path/to/client-key-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838624'],
  },
  'C-0117': {
    description: "Verify kubelet's certificate before establishing connection.",
    remediation:
      'Follow the Kubernetes documentation and setup the TLS connection between the apiserver and kubelets. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--kubelet-certificate-authority` parameter to the path to the cert file for the certificate authority.\n\n \n```\n--kubelet-certificate-authority=<ca-string>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838634'],
  },
  'C-0118': {
    description: 'Do not always authorize all requests.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to values other than `AlwaysAllow`. One such example could be as below.\n\n \n```\n--authorization-mode=RBAC\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838639'],
  },
  'C-0119': {
    description: 'Restrict kubelet nodes to reading only objects associated with them.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to a value that includes `Node`.\n\n \n```\n--authorization-mode=Node,RBAC\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838641'],
  },
  'C-0120': {
    description: 'Turn on Role Based Access Control.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to a value that includes `RBAC`, for example:\n\n \n```\n--authorization-mode=Node,RBAC\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838642'],
  },
  'C-0121': {
    description: 'Limit the rate at which the API server accepts requests.',
    remediation:
      'Follow the Kubernetes documentation and set the desired limits in a configuration file.\n\n Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` and set the below parameters.\n\n \n```\n--enable-admission-plugins=...,EventRateLimit,...\n--admission-control-config-file=<path/to/configuration/file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838644'],
  },
  'C-0122': {
    description: 'Do not allow all requests.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and either remove the `--enable-admission-plugins` parameter, or set it to a value that does not include `AlwaysAdmit`.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838647'],
  },
  'C-0123': {
    description: 'Always pull images.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--enable-admission-plugins` parameter to include `AlwaysPullImages`.\n\n \n```\n--enable-admission-plugins=...,AlwaysPullImages,...\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838649'],
  },
  'C-0125': {
    description: 'Automate service accounts management.',
    remediation:
      'Follow the documentation and create `ServiceAccount` objects as per your environment. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and ensure that the `--disable-admission-plugins` parameter is set to a value that does not include `ServiceAccount`.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838652'],
  },
  'C-0126': {
    description: 'Reject creating objects in a namespace that is undergoing termination.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--disable-admission-plugins` parameter to ensure it does not include `NamespaceLifecycle`.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838653'],
  },
  'C-0127': {
    description: 'Limit the `Node` and `Pod` objects that a kubelet could modify.',
    remediation:
      'Follow the Kubernetes documentation and configure `NodeRestriction` plug-in on kubelets. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the `--enable-admission-plugins` parameter to a value that includes `NodeRestriction`.\n\n \n```\n--enable-admission-plugins=...,NodeRestriction,...\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838655'],
  },
  'C-0129': {
    description: 'Disable profiling, if not needed.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838660'],
  },
  'C-0130': {
    description: 'Enable auditing on the Kubernetes API Server and set the desired audit log path.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-path` parameter to a suitable path and file where you would like audit logs to be written, for example:\n\n \n```\n--audit-log-path=/var/log/apiserver/audit.log\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838662'],
  },
  'C-0131': {
    description: 'Retain the logs for at least 30 days or as appropriate.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxage` parameter to 30 or as an appropriate number of days:\n\n \n```\n--audit-log-maxage=30\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838664'],
  },
  'C-0132': {
    description: 'Retain 10 or an appropriate number of old log files.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxbackup` parameter to 10 or to an appropriate value.\n\n \n```\n--audit-log-maxbackup=10\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838665'],
  },
  'C-0133': {
    description: 'Rotate log files on reaching 100 MB or as appropriate.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxsize` parameter to an appropriate size in MB. For example, to set it as 100 MB:\n\n \n```\n--audit-log-maxsize=100\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838666'],
  },
  'C-0134': {
    description: 'Set global request timeout for API server requests as appropriate.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` and set the below parameter as appropriate and if needed. For example,\n\n \n```\n--request-timeout=300s\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838667'],
  },
  'C-0135': {
    description: 'Validate service account before validating token.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--service-account-lookup=true\n\n```\n Alternatively, you can delete the `--service-account-lookup` parameter from this file so that the default takes effect.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838668'],
  },
  'C-0136': {
    description:
      'Explicitly set a service account public key file for service accounts on the apiserver.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--service-account-key-file` parameter to the public key file for service accounts:\n\n \n```\n--service-account-key-file=<filename>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838669'],
  },
  'C-0137': {
    description: 'etcd should be configured to make use of TLS encryption for client connections.',
    remediation:
      'Follow the Kubernetes documentation and set up the TLS connection between the apiserver and etcd. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the etcd certificate and key file parameters.\n\n \n```\n--etcd-certfile=<path/to/client-certificate-file> \n--etcd-keyfile=<path/to/client-key-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838670'],
  },
  'C-0138': {
    description: 'Setup TLS connection on the API server.',
    remediation:
      'Follow the Kubernetes documentation and set up the TLS connection on the apiserver. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the TLS certificate and private key file parameters.\n\n \n```\n--tls-cert-file=<path/to/tls-certificate-file> \n--tls-private-key-file=<path/to/tls-key-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838671'],
  },
  'C-0139': {
    description: 'Setup TLS connection on the API server.',
    remediation:
      'Follow the Kubernetes documentation and set up the TLS connection on the apiserver. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the client certificate authority file.\n\n \n```\n--client-ca-file=<path/to/client-ca-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838672'],
  },
  'C-0140': {
    description: 'etcd should be configured to make use of TLS encryption for client connections.',
    remediation:
      'Follow the Kubernetes documentation and set up the TLS connection between the apiserver and etcd. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the etcd certificate authority file parameter.\n\n \n```\n--etcd-cafile=<path/to/ca-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838673'],
  },
  'C-0141': {
    description: 'Encrypt etcd key-value store.',
    remediation:
      'Follow the Kubernetes documentation and configure a `EncryptionConfig` file. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the `--encryption-provider-config` parameter to the path of that file:\n\n \n```\n--encryption-provider-config=</path/to/EncryptionConfig/File>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838674'],
  },
  'C-0142': {
    description: 'Where `etcd` encryption is used, appropriate providers should be configured.',
    remediation:
      'Follow the Kubernetes documentation and configure a `EncryptionConfig` file. In this file, choose `aescbc`, `kms` or `secretbox` as the encryption provider.',
    references: ['https://workbench.cisecurity.org/sections/1126663/recommendations/1838675'],
  },
  'C-0144': {
    description: 'Activate garbage collector on pod termination, as appropriate.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--terminated-pod-gc-threshold` to an appropriate threshold, for example:\n\n \n```\n--terminated-pod-gc-threshold=10\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838677'],
  },
  'C-0145': {
    description: 'Disable profiling, if not needed.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838678'],
  },
  'C-0146': {
    description: 'Use individual service account credentials for each controller.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node to set the below parameter.\n\n \n```\n--use-service-account-credentials=true\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838679'],
  },
  'C-0147': {
    description:
      'Explicitly set a service account private key file for service accounts on the controller manager.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--service-account-private-key-file` parameter to the private key file for service accounts.\n\n \n```\n--service-account-private-key-file=<filename>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838680'],
  },
  'C-0148': {
    description:
      "Allow pods to verify the API server's serving certificate before establishing connections.",
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--root-ca-file` parameter to the certificate bundle file`.\n\n \n```\n--root-ca-file=<path/to/file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838681'],
  },
  'C-0149': {
    description: 'Enable kubelet server certificate rotation on controller-manager.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--feature-gates` parameter to include `RotateKubeletServerCertificate=true`.\n\n \n```\n--feature-gates=RotateKubeletServerCertificate=true\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838682'],
  },
  'C-0150': {
    description: 'Do not bind the Controller Manager service to non-loopback insecure addresses.',
    remediation:
      'Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and ensure the correct value for the `--bind-address` parameter',
    references: ['https://workbench.cisecurity.org/sections/1126669/recommendations/1838683'],
  },
  'C-0151': {
    description: 'Disable profiling, if not needed.',
    remediation:
      'Edit the Scheduler pod specification file `/etc/kubernetes/manifests/kube-scheduler.yaml` file on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126670/recommendations/1838684'],
  },
  'C-0152': {
    description: 'Do not bind the scheduler service to non-loopback insecure addresses.',
    remediation:
      'Edit the Scheduler pod specification file `/etc/kubernetes/manifests/kube-scheduler.yaml` on the Control Plane node and ensure the correct value for the `--bind-address` parameter',
    references: ['https://workbench.cisecurity.org/sections/1126670/recommendations/1838685'],
  },
  'C-0153': {
    description: 'Configure TLS encryption for the etcd service.',
    remediation:
      'Follow the etcd service documentation and configure TLS encryption.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameters.\n\n \n```\n--cert-file=</path/to/ca-file>\n--key-file=</path/to/key-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838562'],
  },
  'C-0154': {
    description: 'Enable client authentication on etcd service.',
    remediation:
      'Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter.\n\n \n```\n--client-cert-auth="true"\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838565'],
  },
  'C-0155': {
    description: 'Do not use self-signed certificates for TLS.',
    remediation:
      'Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and either remove the `--auto-tls` parameter or set it to `false`.\n\n \n```\n--auto-tls=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838567'],
  },
  'C-0156': {
    description: 'etcd should be configured to make use of TLS encryption for peer connections.',
    remediation:
      'Follow the etcd service documentation and configure peer TLS encryption as appropriate for your etcd cluster.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameters.\n\n \n```\n--peer-client-file=</path/to/peer-cert-file>\n--peer-key-file=</path/to/peer-key-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838569'],
  },
  'C-0157': {
    description: 'etcd should be configured for peer authentication.',
    remediation:
      'Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter. ```--peer-client-cert-auth=true```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838572'],
  },
  'C-0158': {
    description:
      'Do not use automatically generated self-signed certificates for TLS connections between peers.',
    remediation:
      'Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and either remove the `--peer-auto-tls` parameter or set it to `false`.\n\n \n```\n--peer-auto-tls=false\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838575'],
  },
  'C-0159': {
    description: 'Use a different certificate authority for etcd from the one used for Kubernetes.',
    remediation:
      'Follow the etcd documentation and create a dedicated certificate authority setup for the etcd service.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter.\n\n \n```\n--trusted-ca-file=</path/to/ca-file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126654/recommendations/1838578'],
  },
  'C-0160': {
    description:
      'Kubernetes can audit the details of requests made to the API server. The `--audit-policy-file` flag must be set for this logging to be enabled.',
    remediation: 'Create an audit policy file for your cluster.',
    references: ['https://workbench.cisecurity.org/sections/1126657/recommendations/1838582'],
  },
  'C-0161': {
    description:
      'Ensure that the audit policy created for the cluster covers key security concerns.',
    remediation:
      'Consider modification of the audit policy in use on the cluster to include these items, at a minimum.',
    references: ['https://workbench.cisecurity.org/sections/1126657/recommendations/1838583'],
  },
  'C-0162': {
    description:
      'Ensure that the `kubelet` service file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 /etc/systemd/system/kubelet.service.d/kubeadm.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838585'],
  },
  'C-0163': {
    description: 'Ensure that the `kubelet` service file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root /etc/systemd/system/kubelet.service.d/kubeadm.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838589'],
  },
  'C-0164': {
    description:
      'If `kube-proxy` is running, and if it is using a file-based kubeconfig file, ensure that the proxy kubeconfig file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 <proxy kubeconfig file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838598'],
  },
  'C-0165': {
    description:
      'If `kube-proxy` is running, ensure that the file ownership of its kubeconfig file is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root <proxy kubeconfig file>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838603'],
  },
  'C-0166': {
    description:
      'Ensure that the `kubelet.conf` file has permissions of `600` or more restrictive.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/kubelet.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838607'],
  },
  'C-0167': {
    description: 'Ensure that the `kubelet.conf` file ownership is set to `root:root`.',
    remediation:
      'Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root /etc/kubernetes/kubelet.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838613'],
  },
  'C-0168': {
    description:
      'Ensure that the certificate authorities file has permissions of `600` or more restrictive.',
    remediation:
      'Run the following command to modify the file permissions of the `--client-ca-file`\n\n \n```\nchmod 600 <filename>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838618'],
  },
  'C-0169': {
    description: 'Ensure that the certificate authorities file ownership is set to `root:root`.',
    remediation:
      'Run the following command to modify the ownership of the `--client-ca-file`.\n\n \n```\nchown root:root <filename>\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838619'],
  },
  'C-0170': {
    description:
      'Ensure that if the kubelet refers to a configuration file with the `--config` argument, that file has permissions of 600 or more restrictive.',
    remediation:
      'Run the following command (using the config file location identied in the Audit step)\n\n \n```\nchmod 600 /var/lib/kubelet/config.yaml\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838620'],
  },
  'C-0171': {
    description:
      'Ensure that if the kubelet refers to a configuration file with the `--config` argument, that file is owned by root:root.',
    remediation:
      'Run the following command (using the config file location identied in the Audit step)\n\n \n```\nchown root:root /etc/kubernetes/kubelet.conf\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126659/recommendations/1838629'],
  },
  'C-0172': {
    description: 'Disable anonymous requests to the Kubelet server.',
    remediation:
      'If using a Kubelet config file, edit the file to set `authentication: anonymous: enabled` to `false`.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--anonymous-auth=false\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838638'],
  },
  'C-0173': {
    description: 'Do not allow all requests. Enable explicit authorization.',
    remediation:
      'If using a Kubelet config file, edit the file to set `authorization: mode` to `Webhook`.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_AUTHZ_ARGS` variable.\n\n \n```\n--authorization-mode=Webhook\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838640'],
  },
  'C-0174': {
    description: 'Enable Kubelet authentication using certificates.',
    remediation:
      'If using a Kubelet config file, edit the file to set `authentication: x509: clientCAFile` to the location of the client CA file.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_AUTHZ_ARGS` variable.\n\n \n```\n--client-ca-file=<path/to/client-ca-file>\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838643'],
  },
  'C-0175': {
    description: 'Disable the read-only port.',
    remediation:
      'If using a Kubelet config file, edit the file to set `readOnlyPort` to `0`.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--read-only-port=0\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838645'],
  },
  'C-0176': {
    description: 'Do not disable timeouts on streaming connections.',
    remediation:
      'If using a Kubelet config file, edit the file to set `streamingConnectionIdleTimeout` to a value other than 0.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--streaming-connection-idle-timeout=5m\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838646'],
  },
  'C-0178': {
    description: 'Allow Kubelet to manage iptables.',
    remediation:
      'If using a Kubelet config file, edit the file to set `makeIPTablesUtilChains: true`.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and remove the `--make-iptables-util-chains` argument from the `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838651'],
  },
  'C-0179': {
    description: 'Do not override node hostnames.',
    remediation:
      'Edit the kubelet service file `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` on each worker node and remove the `--hostname-override` argument from the `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838654'],
  },
  'C-0180': {
    description:
      'Security relevant information should be captured. The `--event-qps` flag on the Kubelet can be used to limit the rate at which events are gathered. Setting this too low could result in relevant events not being logged, however the unlimited setting of `0` could result in a denial of service on the kubelet.',
    remediation:
      'If using a Kubelet config file, edit the file to set `eventRecordQPS:` to an appropriate level.\n\n If using command line arguments, edit the kubelet service file `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838656'],
  },
  'C-0181': {
    description: 'Setup TLS connection on the Kubelets.',
    remediation:
      'If using a Kubelet config file, edit the file to set tlsCertFile to the location of the certificate file to use to identify this Kubelet, and tlsPrivateKeyFile to the location of the corresponding private key file.\n\n If using command line arguments, edit the kubelet service file /etc/kubernetes/kubelet.conf on each worker node and set the below parameters in KUBELET\\_CERTIFICATE\\_ARGS variable.\n\n --tls-cert-file=<path/to/tls-certificate-file> --tls-private-key-file=<path/to/tls-key-file>\nBased on your system, restart the kubelet service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838657'],
  },
  'C-0182': {
    description: 'Enable kubelet client certificate rotation.',
    remediation:
      'If using a Kubelet config file, edit the file to add the line `rotateCertificates: true` or remove it altogether to use the default value.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and remove `--rotate-certificates=false` argument from the `KUBELET_CERTIFICATE_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838658'],
  },
  'C-0183': {
    description: 'Enable kubelet server certificate rotation.',
    remediation:
      'The `RotateKubeletServerCertificate` feature gate is enabled by default, so no action is needed unless it has been explicitly disabled.\n\n If it has, edit the kubelet config file specified by `--config` and remove `RotateKubeletServerCertificate: false` from `featureGates`, or edit the kubelet service file on each worker node and remove `RotateKubeletServerCertificate=false` from the `--feature-gates` argument.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838661'],
  },
  'C-0184': {
    description: 'Ensure that the Kubelet is configured to only use strong cryptographic ciphers.',
    remediation:
      'If using a Kubelet config file, edit the file to set `TLSCipherSuites:` to `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_GCM_SHA256` or to a subset of these values.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the `--tls-cipher-suites` parameter as follows, or to a subset of these values.\n\n \n```\n --tls-cipher-suites=TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_GCM_SHA256\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
    references: ['https://workbench.cisecurity.org/sections/1126668/recommendations/1838663'],
  },
  'C-0185': {
    description:
      'The RBAC role `cluster-admin` provides wide-ranging powers over the environment and should be used only where and when needed.',
    remediation:
      'Identify all clusterrolebindings to the cluster-admin role. Check if they are used and if they need this role or if they could use a role with fewer privileges.\n\n Where possible, first bind users to a lower privileged role and then remove the clusterrolebinding to the cluster-admin role :\n\n \n```\nkubectl delete clusterrolebinding [name]\n\n```',
    test: 'Check which subjects have are bound to the cluster-admin role with a clusterrolebinding.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838588'],
  },
  'C-0186': {
    description:
      'The Kubernetes API stores secrets, which may be service account tokens for the Kubernetes API or credentials used by workloads in the cluster. Access to these secrets should be restricted to the smallest possible group of users to reduce the risk of privilege escalation.',
    remediation:
      'Where possible, remove `get`, `list` and `watch` access to `secret` objects in the cluster.',
    test: 'Check which subjects have RBAC permissions to get, list or watch Kubernetes secrets.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838590'],
  },
  'C-0187': {
    description:
      'Kubernetes Roles and ClusterRoles provide access to resources based on sets of objects and actions that can be taken on those objects. It is possible to set either of these to be the wildcard "\\*" which matches all items.\n\n Use of wildcards is not optimal from a security perspective as it may allow for inadvertent access to be granted when new resources are added to the Kubernetes API either as CRDs or in later versions of the product.',
    remediation:
      'Where possible replace any use of wildcards in clusterroles and roles with specific objects or actions.',
    test: 'Check which subjects have wildcard RBAC permissions.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838591'],
  },
  'C-0188': {
    description:
      'The ability to create pods in a namespace can provide a number of opportunities for privilege escalation, such as assigning privileged service accounts to these pods or mounting hostPaths with access to sensitive data (unless Pod Security Policies are implemented to restrict this access)\n\n As such, access to create new pods should be restricted to the smallest possible group of users.',
    remediation: 'Where possible, remove `create` access to `pod` objects in the cluster.',
    test: 'Check which subjects have RBAC permissions to create pods.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838592'],
  },
  'C-0189': {
    description:
      'The `default` service account should not be used to ensure that rights granted to applications can be more easily audited and reviewed.',
    remediation:
      'Create explicit service accounts wherever a Kubernetes workload requires specific access to the Kubernetes API server.\n\n Modify the configuration of each default service account to include this value\n\n \n```\nautomountServiceAccountToken: false\n\n```',
    test: "Checks that each namespace has at least one service account that isn't the default, and checks that the default service accounts have 'automountServiceAccountToken: false' set",
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838594'],
  },
  'C-0190': {
    description:
      'Service accounts tokens should not be mounted in pods except where the workload running in the pod explicitly needs to communicate with the API server',
    remediation:
      'Modify the definition of pods and service accounts which do not need to mount service account tokens to disable it.',
    test: 'Check that all service accounts and workloads disable automount of service account tokens.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838595'],
  },
  'C-0191': {
    description:
      'Cluster roles and roles with the impersonate, bind or escalate permissions should not be granted unless strictly required. Each of these permissions allow a particular subject to escalate their privileges beyond those explicitly granted by cluster administrators',
    remediation: 'Where possible, remove the impersonate, bind and escalate rights from subjects.',
    references: ['https://workbench.cisecurity.org/sections/1126661/recommendations/1838597'],
  },
  'C-0192': {
    description:
      'Every Kubernetes cluster should have at least one policy control mechanism in place to enforce the other requirements in this section. This could be the in-built Pod Security Admission controller, or a third party policy control system.',
    remediation:
      'Ensure that either Pod Security Admission or an external policy control system is in place for every namespace which contains user workloads.',
    test: 'Checks that every namespace enabled pod security admission, or if there are external policies applied for namespaced resources (validating/mutating webhooks)',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838600'],
  },
  'C-0193': {
    description:
      'Do not generally permit containers to be run with the `securityContext.privileged` flag set to `true`.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of privileged containers.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838601'],
  },
  'C-0197': {
    description:
      "Do not generally permit containers to be run with the `allowPrivilegeEscalation` flag set to true. Allowing this right can lead to a process running a container getting more rights than it started with.\n\n It's important to note that these rights are still constrained by the overall container sandbox, and this setting does not relate to the use of privileged containers.",
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of conatiners with `.spec.allowPrivilegeEscalation`set to `true`.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838612'],
  },
  'C-0198': {
    description: 'Do not generally permit containers to be run as the root user.',
    remediation:
      'Create a policy for each namespace in the cluster, ensuring that either `MustRunAsNonRoot` or `MustRunAs` with the range of UIDs not including 0, is set.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838615'],
  },
  'C-0199': {
    description:
      'Do not generally permit containers with the potentially dangerous NET\\_RAW capability.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers with the `NET_RAW` capability.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838617'],
  },
  'C-0201': {
    description: 'Do not generally permit containers with capabilities',
    remediation:
      'Review the use of capabilites in applications runnning on your cluster. Where a namespace contains applicaions which do not require any Linux capabities to operate consider adding a policy which forbids the admission of containers which do not drop all capabilities.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838622'],
  },
  'C-0202': {
    description:
      'Do not generally permit Windows containers to be run with the `hostProcess` flag set to true.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostProcess` containers.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838623'],
  },
  'C-0203': {
    description: 'Do not generally admit containers which make use of `hostPath` volumes.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers which use `hostPath` volumes.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838625'],
  },
  'C-0204': {
    description: 'Do not generally permit containers which require the use of HostPorts.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers which use `hostPort` sections.',
    references: ['https://workbench.cisecurity.org/sections/1126662/recommendations/1838626'],
  },
  'C-0205': {
    description:
      'There are a variety of CNI plugins available for Kubernetes. If the CNI in use does not support Network Policies it may not be possible to effectively restrict traffic in the cluster.',
    remediation:
      'If the CNI plugin in use does not support network policies, consideration should be given to making use of a different plugin, or finding an alternate mechanism for restricting traffic in the Kubernetes cluster.',
    references: ['https://workbench.cisecurity.org/sections/1126664/recommendations/1838627'],
  },
  'C-0206': {
    description: 'Use network policies to isolate traffic in your cluster network.',
    remediation:
      'Follow the documentation and create `NetworkPolicy`, `CiliumNetworkPolicy`, or `CiliumClusterwideNetworkPolicy` objects as you need them.',
    test: 'Check for each namespace if there is a network policy defined (NetworkPolicy, CiliumNetworkPolicy, or qualifying CiliumClusterwideNetworkPolicy).',
    references: ['https://workbench.cisecurity.org/sections/1126664/recommendations/1838628'],
  },
  'C-0207': {
    description:
      'Kubernetes supports mounting secrets as data volumes or as environment variables. Minimize the use of environment variable secrets.',
    remediation:
      'If possible, rewrite application code to read secrets from mounted secret files, rather than from environment variables.',
    test: 'Check if pods have secrets in their environment variables',
    references: ['https://workbench.cisecurity.org/sections/1126665/recommendations/1838630'],
  },
  'C-0208': {
    description:
      'Consider the use of an external secrets storage and management system, instead of using Kubernetes Secrets directly, if you have more complex secret management needs. Ensure the solution requires authentication to access secrets, has auditing of access to and use of secrets, and encrypts secrets. Some solutions also make it easier to rotate secrets.',
    remediation:
      'Refer to the secrets management options offered by your cloud provider or a third-party secrets management solution.',
    test: 'Checking encryption configuration to see if secrets are managed externally by kms using aws, azure, or akeyless vault',
    references: ['https://workbench.cisecurity.org/sections/1126665/recommendations/1838631'],
  },
  'C-0209': {
    description: 'Use namespaces to isolate your Kubernetes objects.',
    remediation:
      'Follow the documentation and create namespaces for objects in your deployment as you need them.',
    test: 'Lists all namespaces in cluster for user to review',
    references: ['https://workbench.cisecurity.org/sections/1126667/recommendations/1838633'],
  },
  'C-0210': {
    description: 'Enable `docker/default` seccomp profile in your pod definitions.',
    remediation:
      'Use security context to enable the `docker/default` seccomp profile in your pod definitions. An example is as below:\n\n \n```\n  securityContext:\n    seccompProfile:\n      type: RuntimeDefault\n\n```',
    test: 'Checks if seccomp profile is defined as type RuntimeDefault in security context of workload or container level',
    references: ['https://workbench.cisecurity.org/sections/1126667/recommendations/1838635'],
  },
  'C-0211': {
    description: 'Apply Security Context to Your Pods and Containers',
    remediation:
      'Follow the Kubernetes documentation and apply security contexts to your pods. For a suggested list of security contexts, you may refer to the CIS Security Benchmark for Docker Containers.',
    test: 'Check that pod and container security context fields according to recommendations in CIS Security Benchmark for Docker Containers',
    references: ['https://workbench.cisecurity.org/sections/1126667/recommendations/1838636'],
  },
  'C-0212': {
    description:
      'Kubernetes provides a default namespace, where objects are placed if no namespace is specified for them. Placing objects in this namespace makes application of RBAC and other controls more difficult.',
    remediation:
      'Ensure that namespaces are created to allow for appropriate segregation of Kubernetes resources and that all new resources are created in a specific namespace.',
    test: 'Lists all resources in default namespace for user to review and approve.',
    references: ['https://workbench.cisecurity.org/sections/1126667/recommendations/1838637'],
  },
  'C-0236': {
    description: 'Verifies the signature of each image with given public keys',
    remediation: 'Replace the image with an image that is signed correctly',
  },
  'C-0237': {
    description: 'Ensures that all images contain some signature',
    remediation: 'Replace the image with a signed image',
  },
  'C-0246': {
    description:
      'The special group `system:masters` should not be used to grant permissions to any user or service account, except where strictly necessary (e.g. bootstrapping access prior to RBAC being fully available)',
    remediation: 'Remove the `system:masters` group from all users in the cluster.',
    references: [
      'https://github.com/kubernetes/kubernetes/blob/master/pkg/registry/rbac/escalation_check.go#L38',
    ],
  },
  'C-0260': {
    description:
      'This control detects workloads that has no NetworkPolicy configured in labels. If a network policy is not configured, it means that your applications might not have necessary control over the traffic to and from the pods, possibly leading to a security vulnerability.',
    remediation:
      "Review the workloads identified by this control and assess whether it's necessary to configure a network policy for them.",
    test: 'Check that all workloads has a network policy configured in labels.',
  },
  'C-0263': {
    description: 'This control detect Ingress resources that do not use TLS',
    remediation:
      'The user needs to implement TLS for the Ingress resource in order to encrypt the incoming traffic',
    test: 'Check if the Ingress resource has TLS configured',
  },
  'C-0264': {
    description: 'This control detects PersistentVolumes without encyption',
    remediation:
      'Enable encryption on the PersistentVolume using the configuration in StorageClass',
    test: 'Checking all PersistentVolumes via their StorageClass for encryption',
  },
  'C-0270': {
    description: 'This control identifies all Pods for which the CPU limits are not set.',
    remediation:
      'Set the CPU limits or use exception mechanism to avoid unnecessary notifications.',
  },
  'C-0271': {
    description: 'This control identifies all Pods for which the memory limits are not set.',
    remediation:
      'Set the memory limits or use exception mechanism to avoid unnecessary notifications.',
  },
  'C-0275': {
    description: 'Do not generally permit containers to be run with the hostPID flag set to true.',
    remediation:
      'Configure the Admission Controller to restrict the admission of `hostPID` containers.',
    references: ['https://workbench.cisecurity.org/sections/2633390/recommendations/4261968'],
  },
  'C-0276': {
    description: 'Do not generally permit containers to be run with the hostIPC flag set to true.',
    remediation:
      'Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostIPC` containers.',
    references: ['https://workbench.cisecurity.org/sections/2633390/recommendations/4261969'],
  },
  'C-0277': {
    description:
      'Ensure that the API server is configured to only use strong cryptographic ciphers.',
    remediation:
      'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml on the Control Plane node and set the below parameter.\n\n \n```\n--tls-cipher-suites=TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256, TLS_ECDHE_ECDSA_WITH_RC4_128_SHA, TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA, TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256, TLS_ECDHE_RSA_WITH_RC4_128_SHA, TLS_RSA_WITH_3DES_EDE_CBC_SHA, TLS_RSA_WITH_AES_128_CBC_SHA, TLS_RSA_WITH_AES_128_CBC_SHA256, TLS_RSA_WITH_AES_128_GCM_SHA256, TLS_RSA_WITH_AES_256_CBC_SHA, TLS_RSA_WITH_AES_256_GCM_SHA384, TLS_RSA_WITH_RC4_128_SHA.\n\n```',
    references: ['https://workbench.cisecurity.org/sections/2633389/recommendations/4262031'],
  },
  'C-0278': {
    description:
      'The ability to create persistent volumes in a cluster can provide an opportunity for privilege escalation, via the creation of hostPath volumes.',
    remediation:
      'Where possible, remove `create` access to `persistentvolume` objects in the cluster.',
    test: 'Check which subjects have RBAC permissions to create persistentvolumes.',
    references: ['https://workbench.cisecurity.org/sections/2633388/recommendations/4261959'],
  },
  'C-0279': {
    description:
      'Users with access to the Proxy sub-resource of Node objects automatically have permissions to use the Kubelet API, which may allow for privilege escalation or bypass cluster security controls such as audit logs.',
    remediation: 'Where possible, remove access to the proxy sub-resource of node objects.',
    test: 'Check which subjects have RBAC permissions to access the proxy sub-resource of node objects.',
    references: ['https://workbench.cisecurity.org/sections/2633388/recommendations/4261961'],
  },
  'C-0280': {
    description:
      'Users with access to the update the `approval` sub-resource of `certificatesigningrequests` objects can approve new client certificates for the Kubernetes API effectively allowing them to create new high-privileged user accounts.\n\n This can allow for privilege escalation to full cluster administrator, depending on users configured in the cluster',
    remediation:
      'Where possible, remove access to the `approval` sub-resource of `certificatesigningrequests` objects.',
    test: 'Check which subjects have RBAC permissions to update the approval sub-resource of certificatesigningrequests objects.',
    references: ['https://workbench.cisecurity.org/sections/2633388/recommendations/4261962'],
  },
  'C-0281': {
    description:
      'Users with rights to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations can control webhooks that can read any object admitted to the cluster, and in the case of mutating webhooks, also mutate admitted objects. This could allow for privilege escalation or disruption of the operation of the cluster.',
    remediation:
      'Where possible, remove access to the validatingwebhookconfigurations or mutatingwebhookconfigurations objects',
    test: 'Check which subjects have RBAC permissions to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations objects.',
    references: ['https://workbench.cisecurity.org/sections/2633388/recommendations/4261963'],
  },
  'C-0282': {
    description:
      'Users with rights to create new service account tokens at a cluster level, can create long-lived privileged credentials in the cluster. This could allow for privilege escalation and persistent access to the cluster, even if the users account has been revoked.',
    remediation:
      'Where possible, remove access to the token sub-resource of serviceaccount objects.',
    test: 'Check which subjects have RBAC permissions to create the token sub-resource of serviceaccount objects.',
    references: ['https://workbench.cisecurity.org/sections/2633388/recommendations/4261965'],
  },
  'C-0283': {
    description:
      'This admission controller rejects all net-new usage of the Service field externalIPs.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and add the `--enable-admission-plugins=DenyServiceExternalIPs` parameter\n\n or\n\n The Kubernetes API server flag disable-admission-plugins takes a comma-delimited list of admission control plugins to be disabled, even if they are in the list of plugins enabled by default.\n\n `kube-apiserver --disable-admission-plugins=DenyServiceExternalIPs,AlwaysDeny ...`',
    references: ['https://workbench.cisecurity.org/sections/2633389/recommendations/4261958'],
  },
  'C-0284': {
    description:
      'Ensure that the Kubelet sets limits on the number of PIDs that can be created by pods running on the node.',
    remediation:
      'Decide on an appropriate level for this parameter and set it, either via the `--pod-max-pids` command line parameter or the `PodPidsLimit` configuration file setting.',
    references: ['https://workbench.cisecurity.org/sections/2633393/recommendations/4262020'],
  },
  'C-0286': {
    description:
      'Kubernetes provides the option to use client certificates for user authentication. However as there is no way to revoke these certificates when a user leaves an organization or loses their credential, they are not suitable for this purpose.\n\n It is not possible to fully disable client certificate use within a cluster as it is used for component to component authentication.',
    remediation:
      'Alternative mechanisms provided by Kubernetes such as the use of OIDC should be implemented in place of client certificates.',
    references: ['https://workbench.cisecurity.org/sections/2633383/recommendations/4261934'],
  },
  'C-0287': {
    description:
      'Kubernetes provides service account tokens which are intended for use by workloads running in the Kubernetes cluster, for authentication to the API server.\n\n These tokens are not designed for use by end-users and do not provide for features such as revocation or expiry, making them insecure. A newer version of the feature (Bound service account token volumes) does introduce expiry but still does not allow for specific revocation.',
    remediation:
      'Alternative mechanisms provided by Kubernetes such as the use of OIDC should be implemented in place of service account tokens.',
    references: ['https://workbench.cisecurity.org/sections/2633383/recommendations/4261935'],
  },
  'C-0288': {
    description:
      'Kubernetes provides bootstrap tokens which are intended for use by new nodes joining the cluster\n\n These tokens are not designed for use by end-users they are specifically designed for the purpose of bootstrapping new nodes and not for general authentication',
    remediation:
      'Alternative mechanisms provided by Kubernetes such as the use of OIDC should be implemented in place of bootstrap tokens.',
    references: ['https://workbench.cisecurity.org/sections/2633383/recommendations/4261936'],
  },
  'C-0289': {
    description: 'Configure Image Provenance for your deployment.',
    remediation: 'Follow the Kubernetes documentation and setup image provenance.',
    references: ['https://workbench.cisecurity.org/sections/2633394/recommendations/4261995'],
  },
  'C-0290': {
    description:
      'By default Kubernetes extends service account token lifetimes to one year. This should be set to false for security.',
    remediation:
      'Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n```\n--service-account-extend-token-expiration=false\n```',
  },
  'C-0291': {
    description: 'Do not bind the kube-proxy metrics port to non-loopback addresses.',
    remediation:
      'If running kube-proxy with a configuration file, edit the kube-proxy configuration file and set the metricsBindAddress to `127.0.0.1:10249`.\n\nIf running kube-proxy with command line arguments, set `--metrics-bind-address=127.0.0.1:10249`.\n\nRestart kube-proxy for changes to take effect.',
  },
  'C-0292': {
    description:
      'The nginx ingress controller project reaches End of Life (EOL) in March 2026. After this date, no security patches or functional updates will be provided. This control identifies workloads using nginx ingress controllers to help users plan migration to supported alternatives.',
    remediation:
      'Migrate to a supported ingress controller solution: 1) F5 NGINX Ingress Controller (https://docs.nginx.com/nginx-ingress-controller/) for a supported NGINX-based option, 2) Kubernetes Gateway API for a cloud-native approach, 3) HAProxy Ingress, 4) Traefik, 5) Cloud-native solutions (AWS ALB Ingress Controller, GKE Ingress, Azure Application Gateway Ingress Controller). Plan your migration before the EOL date to ensure continued security and support.',
    test: 'Check if any Deployment, DaemonSet, or StatefulSet is using nginx ingress controller images (including patterns like nginx-ingress-controller, ingress-nginx/controller, k8s.gcr.io/ingress-nginx, registry.k8s.io/ingress-nginx)',
  },
  'C-0306': {
    description:
      'Fails if a container image reference is not pinned to an immutable digest (image@sha256:...). Pinning makes the image reference immutable, closing the TOCTOU window where an image signature (C-0236) is verified against a mutable tag that can be re-pointed after verification, causing the kubelet to pull something that was never verified.',
    remediation: 'Pin container images to an immutable digest (image@sha256:...).',
    test: 'Check that every container image reference is pinned to a digest.',
  },
  'C-0318': {
    description:
      'Enable the RuntimeDefault seccomp profile for all workloads that do not specify one.',
    remediation:
      'Set the parameter, either via the `--seccomp-default` command line argument or the `seccompDefault` setting in the kubelet config file. Setting it to `true` enables the RuntimeDefault profile for workloads that do not declare one.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```',
  },
};

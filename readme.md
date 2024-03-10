**Hashicorp Vault para gerenciamento de Segredos em ambiente Kubernetes**

**Motivação**

O HashiCorp Vault é uma ferramenta para gerenciamento de segredos, proteção de dados e controle de acesso. Integrá-lo ao Kubernetes traz diversos benefícios, incluindo o gerenciamento centralizado de segredos sensíveis como senhas de banco de dados, chaves de API, certificados TLS e outros dados sensíveis.

Embora os segredos do Kubernetes sejam uma opção válida para muitos cenários, o HashiCorp Vault pode oferecer recursos adicionais e uma maior flexibilidade para atender a necessidades específicas de segurança e conformidade em ambientes de contêineres e nuvem, como:

*   Gerenciamento centralizado de segredos
*   Controle de Acesso Granular
*   Integração com Diversos Serviços e Tecnologias
*   Segurança Avançada
*   Recursos de Criptografia

**Ambiente**

Para demonstrar a implantação do Hashicorp Vault optaremos por executar um cluster Kubernetes localmente usando “nós” de contêiner do Docker. Para tanto usaremos o **kinD** (https://kind.sigs.k8s.io/), uma solução projetada para testar o próprio Kubernetes, mas pode ser usada para desenvolvimento local ou CI.

**Preparação do ambiente local**

1\. Instalar kinD

```plaintext
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

2\. Instalar Kubectl

```plaintext
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x ./kubectl
sudo mv ./kind /usr/local/bin/kubectl
```

3\. Instalar Helm

```plaintext
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```

**Criação do Cluster Kubernetes usando kinD**

```plaintext
kind create cluster --name devops --config ./kindcluster.yml
```

Para verificar se o cluster está funcionando corretamente é possível fazê-lo pelos seguintes comandos:

```plaintext
kind get clusters
kubectl config get-contexts
kind delete cluster --name devops
```

**Implantação do Vault**

A implantação do Hashicorp Vault se dará utilizando Helm. _Helm_ é um gerenciador de pacotes para Kubernetes que inclui todos os códigos e recursos necessários para implantar uma aplicação.

```plaintext
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault
```

A documentação do Hashicorp Vault é bastante completa em relação a implantação e uso da solução. Para servir de guia adicional deixaremos como referência o link de download e instalação da ferramenta e seu repositório no github:

*   https://github.com/hashicorp/vault-helm
*   https://developer.hashicorp.com/vault/downloads

Para facilitar a iteração com o Vault é possível fazer uso de uma CLI, em que pese seja possíve utilizar a própria interface gráfica do Vault ou executar os comandos por meio de comandos dentro do próprio container.

A instalação do CLI pode ser realizada pelos seguintes comandos:

```plaintext
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault

ou

curl -Lo ./vaultcli.zip https://releases.hashicorp.com/vault/1.15.6/vault_1.15.6_linux_amd64.zip
unzip vaultcli.zip
chmod +x ./vault
sudo mv ./vault /usr/local/bin/vault
```

Caso vá prosseguir utilizando o CLI, é necessário configurar a variável de ambiente VAULT\_ADDR. Mas primeiro é necessário verificar em qual endereço interno o serviço está executando:

```plaintext
kubectl get svc   #Para verificar o serviço vault
kubectl port-forward service/vault 8200:8200   #Expõe a porta para conexão
export VAULT_ADDR="http://localhost:8200"   #Configura a variável de ambiente
vault status   #Verifica o status do Vault e se a conexão pode ser estabelecida
```

De forma alternativa é possível acessar o container internamente para executar os comandos a seguir:

```plaintext
kubectl exec -it vault-0 -- sh
```

Para seguir neste guia você poderá executar os comandos vault… pela CLI ou acessando o container.

**Inicialização do Vault**

Na primeira vez que utilizar o Vault será necessário inicializá-lo, o que gerará 5 chaves de abertura do selo do cofre (Unseal key).

```plaintext
vault operator init

Retorno:
Unseal Key 1: axl6XWVwMnRNPl/V5+6x6OMXlGspK+g4BHZXsWM1i7SY
Unseal Key 2: /9sAOJmKdj8TfMRD8tGnFzgRloGodXXzxXyqkSuMubqj
Unseal Key 3: leWjXPEVmAOty1K7d7P0IJt7tOx2J+gDHQgPD30dOirX
Unseal Key 4: KwRLIZPtXirDKWYyt5IJNkKeEKLOECdJiRwuZuji5sZ6
Unseal Key 5: r4IyWb9KbMtj868Ww9lBhItewxjS5Ev2vbA8OehPtd7B
Initial Root Token: hvs.9ZmAtHhZfcdtaaXvhoSAUgo6
```

É importante que todas essas chaves geradas estejam em lugar protegido.

**Abertura do selo do Vault**

O Vault não é acessível, de forma alguma, sem que antes seja aberto o selo, o que exigirá 3 das 5 Unseal Key.

Este procedimento pode ser realizado pela interface gráfica, mas aqui o faremos utilizando o terminal. Executar 3 vezes o comando a seguir informando sempre uma chave diferente em cada vez até que **Sealed = false:**

```plaintext
vault operator unseal
```

Ao final realizar login no Vault usando o _Initial Root Token_

```plaintext
vault login

Retorno:
token_accessor      AKG0jnHfQCaTNzoEq8Ihy0se
```

É importante que se crie um política de acesso específico somente para leitura dos segredos. A seguir criaremos uma para Policy que permita a determinado usuário apenas ler o determinado path do vault:

```plaintext
vault policy write geia-policy geia-policy.hcl
```

Além disso, vamos criar um token vinculando esta policy. Será este o token a ser usado sempre que uma requisição for realizada ao Vault.

```plaintext
vault token create -policy=geia-policy

Retorno:
Key                 Value
---                 -----
token               hvs.CAESIP6fqDyb0a48qNaPsjYAoQgOhz96fvOgavEkkFoknqkwGh4KHGh2cy5jTW5PNGREc1FNNGJlWnJ0YTlrdlFWWEk
token_accessor      Gx4no0QHLUWbK1LOkF8K5VMH
token_duration      768h
token_renewable     true
token_policies      ["default" "geia-policy"]
identity_policies   []
policies            ["default" "geia-policy"]
```

Este token, futuramente poderá ser armazenado em uma secret no kubernetes, o qual será usado pelo  External Secret Operator para acessar o vault.

Agora nosso Vault está pronto para receber e disponibilizar segredos. Com a policy e o token criado podemos incluir segredos no formado chave/valor para serem acessados sempre que necessário:

```plaintext
vault secrets enable -path=devops kv
vault kv put devops/geia user=admin senha=12345
vault kv get devops/geia    #Teste para obter o segredo
```

Uma vez que o Hashicorp Vault está configurado e com segredos armazenados, partimos para etapa em que é necessário configurar a vinculação do Vault e o ambiente kubernetes. Para isso utilizaremos o External Secret Operator.

**External Secret Operator**

O External Secret Operator é uma ferramenta para Kubernetes que permite a integração do Kubernetes com sistemas externos de gerenciamento de segredos, como o HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, entre outros.

A principal função do External Secret Operator é sincronizar automaticamente segredos armazenados em sistemas externos com o Kubernetes, tornando-os acessíveis para as aplicações implantadas no cluster Kubernetes.

O External Secret Operator geralmente funciona monitorando recursos do Kubernetes, como objetos ExternalSecret, que são definidos para especificar quais segredos externos devem ser sincronizados e como eles devem ser mapeados para segredos nativos do Kubernetes.

**Instalação do External Secret Operator**

```plaintext
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace --set installCRDs=true
```

Dos conceitos importante do External Secret Operator, destacamos 2 que representam objetos kubernetes necessários de serem implantados:

*   **ExternalSecret:** _Qual secret quero ter acesso_
*   **SecretStore e ClusterSecretStore:** _Como tenho acesso ao secret dentro do vault_

Antes de iniciarmos a implantação desses objetos, primeiro vamos criar uma secret no kubernetes para armazenar o token que criamos em etapas anteriores e nos proporcionará a autenticação para acesso ao vault.

```plaintext
kubectl create secret generic vault-policy-token --from-literal=token=hvs.CAESIP6fqDyb0a48qNaPsjYAoQgOhz96fvOgavEkkFoknqkwGh4KHGh2cy5jTW5PNGREc1FNNGJlWnJ0YTlrdlFWWEk
```

Agora vamos ensinar o kubernetes a como ter acesso a um segredo dentro do vault. No caso, isto será feito por um **ClusterSecretStore:**

```plaintext
kubectl apply -f cluster-secret-store.yml
```

E agora informar ao kubernetes qual secret acessar no vault, usando uma **ExternalSecret**:

```plaintext
kubectl apply -f external-secret.yml
```

Pronto, agora verificaremos se está tudo ok e sincronizando por meio dos seguinte comandos:

```plaintext
kubectl get clustersecretstore
kubectl get externalsecret
```

Estando tudo certo, é possível constatar a criação de uma nova secret no kubernetes referente secret armazenada no vault:

```plaintext
kubectl get secret
kubectl get secret devops-geia -o yaml
```

**Demonstração de uso**

Para demonstrar que tudo que explanamos acima funciona a contanto, desenvolvemos uma pequena aplicação JavaScritp buscando as secrets inseridas no Vault e sincronizadas no kubernetes. Esta aplicação será implantada no kubernetes, fará a leitura de duas variáveis (user e senha) e as exibirá em tela, a título de exemplo.

Criamos uma imagem a partir do diretório demo:

```plaintext
docker build -t demo:v1 .
```

Ao invés de subir a imagem para um registry público, utilizaremos um recurso do kinD que nos permite carregar as imagens no ambiente e utilizá-las ao implantar a aplicação:

```plaintext
kind load docker-image demo:v1 --name devops 
```

Por fim, fazemos o deploy da aplicação, incluindo no manifesto a criação do serviço:

```plaintext
kubectl apply -f deployment.yaml
```

Passo adicional é expor a porta do serviço para que seja acessível:

```plaintext
kubectl port-forward svc/demo --address 0.0.0.0 3000:3000
```

Basta agora acessar o navegador de internet e verificar as secrets inseridas.

```plaintext
http://localhost:3000
```

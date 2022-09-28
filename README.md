# Serveur Websocket

## Prérequis
- Avoir NPM

## Installer les dépendances NPM
Afin d'installer toutes les dépendances JavaScript, il vous suffit d'effectuer un ``npm install``

## Consignes pour GIT
Si vous avez accès à ce répertoire contenant l'ensemble du serveur WS et que vous travaillez dessus, vous devez respecter certaines règles à propos du GIT :


- Vous devez **absolument** créer une nouvelle branche lorsque vous développer une fonctionnalité ou corriger une anomalie comme l'exemple suivant :

Imaginons vous devez régler l'anomalie 344 du système de tickets de GitHub, vous devez créer une branche commençant par **Anomalie-344/NomDuProbleme**.

__*Créer une branche en CLI GIT :*__ ``git branch Anomalie-344/NomDuProbleme``

-> Si vous essayez de push sur la branche main, vous serez bloqué pour des raisons de sécurité.

Après avoir crée votre branche au nom de votre anomalie/feature/..., vous pouvez coder sur cette branche.

__*Entrez dans la branche en CLI GIT :*__ ``git checkout Anomalie-344/NomDuProbleme``



- Lorsque vous voulez soumettre votre code et l'envoyer sur le répertoire GIT, vous devez suivre ces étapes :

### 1) Vérifier le status **(Important de revenir souvent à cette étape)**
Permet de lister les fichiers et dossiers qui ne sont :
- (en rouge) | pas ajouté au commit donc qui contiennent des éléments nouveaux
- (en vert) | en ajout mais il faut faire un commit (= un paquet)
__*Vérifier le status en CLI GIT :*__ ``git status``

### 2) Ajouter un/des fichier(s)
* __*Ajouter les fichiers en CLI GIT :*__ ``git add nomdufichier.extension`` (Recommandé si grosse correction/feature)
* __*Ajouter tous les fichiers en CLI GIT :*__ ``git add .`` (Recommandé si vous êtes sur de vous)

### 3) Créer un commit
__*Créer un commit en CLI GIT :*__ ``git commit -m "correction du menu"``

### 4) Push !
Une fois votre/vos commit(s) effectué(s), vous pouvez push !
__*Push en CLI GIT :*__ ``git push origin Anomalie-344/nomDuProbleme``

### 5) Faire une Pull Request
Rendez vous sur le répertoire GitHub afin de faire une *Pull Request*.

- Allez dans **Pull requests** sur le menu du répertoire GitHub
- Faites **New pull request**
- Sélectionnez dans le select **compare** votre branche
- Cliquez sur **Create pull request**
- Suivez les instructions à l'écran puis ajouté des commentaires si besoin.
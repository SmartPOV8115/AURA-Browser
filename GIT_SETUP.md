# AURA Browser Git Workflow

This project is a Git repository.

## First setup on a machine

```cmd
git clone <your-repository-url>
cd AURA_Browser_Prototype
npm install
npm start
```

## Normal development cycle

```cmd
git status
git add .
git commit -m "Describe the change"
```

## Update the project from the repository

```cmd
git pull
npm install
npm start
```

`npm install` is only needed when `package.json` / dependencies change or after a fresh clone.

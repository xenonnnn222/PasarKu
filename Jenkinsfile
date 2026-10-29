pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        timestamps()
    }
    stages {
        stage('Install & Test') {
            steps { sh 'bash deploy/ci.sh' }
        }
        stage('Deploy Laravel') {
            when {
                expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' }
            }
            steps { sh 'bash deploy/deploy.sh' }
        }
    }
    post {
        always { junit allowEmptyResults: true, testResults: 'build/junit.xml' }
    }
}

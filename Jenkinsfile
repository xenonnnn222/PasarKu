pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        timestamps()
    }
    environment {
        // Laravel butuh PHP 8.3+; ubah ke 'true' setelah server siap.
        LARAVEL_ENABLED = 'false'
    }
    stages {
        stage('Build & Deploy React') {
            when {
                expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' }
            }
            steps { sh 'bash deploy/react.sh' }
        }
        stage('Install & Test') {
            when { environment name: 'LARAVEL_ENABLED', value: 'true' }
            steps { sh 'bash deploy/ci.sh' }
        }
        stage('Deploy Laravel') {
            when {
                allOf {
                    environment name: 'LARAVEL_ENABLED', value: 'true'
                    expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' }
                }
            }
            steps { sh 'bash deploy/deploy.sh' }
        }
    }
    post {
        always { junit allowEmptyResults: true, testResults: 'build/junit.xml' }
    }
}

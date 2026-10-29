pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        timestamps()
    }
    stages {
        // Logika tes dan deploy ada di deploy/jenkins.sh agar sama dengan job Freestyle.
        stage('Test & Deploy Laravel') {
            steps { sh 'bash deploy/jenkins.sh' }
        }
    }
    post {
        always { junit allowEmptyResults: true, testResults: 'build/junit.xml' }
    }
}

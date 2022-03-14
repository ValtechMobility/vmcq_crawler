FROM node:16

WORKDIR /opt/app

RUN apt-get update
RUN apt-get install apt-transport-https curl gnupg wget jq tar unzip apt-utils -yqq
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" | tee /etc/apt/sources.list.d/sbt.list
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian /" | tee /etc/apt/sources.list.d/sbt_old.list
RUN curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" | gpg --no-default-keyring --keyring gnupg-ring:/etc/apt/trusted.gpg.d/scalasbt-release.gpg --import
RUN chmod 644 /etc/apt/trusted.gpg.d/scalasbt-release.gpg
RUN apt-get update
RUN apt-get install default-jdk -yqq
RUN java -version
RUN apt-get install sbt -yqq
RUN sbt -version
RUN apt-get install maven -yqq
RUN mvn -version
RUN apt-get install python3-pip -yqq
RUN pip3 --version
RUN pip3 install yq
RUN jq --version
RUN yq --version
RUN xq --version

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci
COPY index.js index.js

CMD node index.js
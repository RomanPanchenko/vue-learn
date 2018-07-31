# Small vue/vuex environment inside Docker container for Vue.js beginners

## Prerequesites
You should have installed Docker environment

## Project setup

### Clone the repository
```
git clone https://github.com/RomanPanchenko/vue-learn.git
```

### Go to the folder with cloned repository
```
cd ./vue-learn/
```

### Build Docker contained
```
docker-compose build
```

### Run the container
```
docker-compose up
```


### Link for browser

After container is started, you'll see something like
```
vue-learn_1  |   App running at:
vue-learn_1  |   - Local:   http://localhost:8080/
vue-learn_1  |   - Network: http://172.19.0.2:8080/
```
Type http://localhost:8082/ into address bar of your browser and press Enter

(Port 8082 can be changed in file docker-compose.yml)

### Rebuild Docker container if you changed Dockerfile
```
docker-compose build
```
or rebuild & run
```
docker-compose up --build
```

### Stop container
You can just press Ctrl+C twice (don't know about MAC, may be Cmd+C twice)

### In some cases you have to remove and rebuild your container from scratch
To do that please do that execute in your vue-learn folder:
```
/vue-learn $ docker-compose rm vue-learn

/vue-learn $ docker-compose build --no-cache

/vue-learn $ docker-compose up
```

# Version our container with the current commit hash
# If our tree isn't clean we'll append "-local" to the version
# Untracked files are ignored when considering whether the tree is clean
REV:=$(shell git rev-parse HEAD)
# It's possible to add --show-untracked=no to the git status command to ignore untracked files
VER:=${REV}$(shell if [[ `git status --porcelain` ]]; then echo "-local"; fi)
REPO:=casablanca-casa-docker-release.jfrog.io
NAME:=finance-portal-backend-service
TAG:=${REPO}/${NAME}:${VER}
REPO_ROOT:=$(shell git rev-parse --show-toplevel)
DOCKER_BUILD_OPTS:=--pull=true
NPMRC_B64:=$(shell base64 -w 0 < ./src/.npmrc)
LISTEN_PORT=3002

## NORMAL BUILDS
# Containing any local modifications or untracked files, if present. If none are present, will
# produce a clean build.

all: build

build:
	docker build -t ${TAG} ${DOCKER_BUILD_OPTS} --build-arg NPMRC_B64="${NPMRC_B64}" .

run: build
	docker run --env-file=.env -p ${LISTEN_PORT}:3002 ${TAG}

push: build
	docker push ${TAG}


## CLEAN BUILDS
# Create a build from the current repo HEAD, without modifications or untracked files

build_clean: create_clean_temp_repo
	docker build -t ${REPO}/${NAME}:${REV} ${DOCKER_BUILD_OPTS} --build-arg NPMRC_B64="${NPMRC_B64}" ${CLEAN_BUILD_DIR}

run_clean: build_clean
	docker run --env-file=.env -p ${LISTEN_PORT}:3002 ${TAG}

push_clean: build_clean
	docker push ${REPO}/${NAME}:${REV}

# Copy the repo to a temp directory, hard reset to HEAD, remove all untracked files in the repo and
# any submodules.
#
# Note that we eval CLEAN_BUILD_DIR on the first line so that it's not created for every rule and
# cluttering up our /tmp dir (which, although relatively benign, could be pretty annoying in some
# circumstances). Further note that CLEAN_BUILD_DIR has "file-level" scope, not target-level scope.
create_clean_temp_repo:
	$(eval CLEAN_BUILD_DIR:=$(shell mktemp -d))
	cp -a ${REPO_ROOT}/. ${CLEAN_BUILD_DIR}
	git -C ${CLEAN_BUILD_DIR} clean -xdff
	git -C ${CLEAN_BUILD_DIR} reset --hard

.PHONY: build build_clean

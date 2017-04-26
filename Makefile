test: npm_modules 
	{ testrpc -d > /tmp/testrpc.log & echo $$! > /tmp/testrpc.pid; }
	-truffle test
	kill `cat /tmp/testrpc.pid`

cover: fulltest
	open ./solcover/coverage/lcov-report/index.html

fulltest: npm_modules solcover
	( cd solcover ; node ./runCoveredTests.js )
	eslint test

solcover:
	git clone http://github.com/adriamb/solcover.git
	( cd solcover ; git checkout 4e22facad7cfe2be5545cfcbdee16094678e9601 ; npm install )

npm_modules:
	npm install

install:
	npm install truffle@3.2.1 -g
	npm install eslint@3.19.0 -g
	npm install babel-eslint@6 -g
	npm install eslint-config-airbnb -g
	npm install eslint-plugin-jsx-a11y -g
	npm install eslint-plugin-react -g
	npm install eslint-plugin-import -g

travis: install npm_modules solcover fulltest
	./node_modules/.bin/codecov

.PHONY: test
.PHONY: cover
.PHONY: fulltest
.PHONY: install
.PHONY: travis

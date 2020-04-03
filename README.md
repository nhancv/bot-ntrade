# NTradeBot

This source implement binary trading for http://alpari.io market

## Install
```
npm install
```

## Update .env
- Copy `.env_sample` to `.env`
- Correct value in `.env`

## Dev
```
npm start
```

## Build release for prod and staging
```
npm run build
```

## Deploy to integration [HEROKU]

### Getting started with Heroku
```
heroku login
heroku create <app name>
git add .
git commit -m 'deploy to heroku'
git push heroku master

Test at: <app name>.herokuapp.com
Log view: heroku logs -t
``` 

### Update on Heroku
```
git push heroku master

=>>
- Git: https://git.heroku.com/ntradebot.git
- App: https://ntradebot.herokuapp.com/
- Dashboard: https://dashboard.heroku.com/apps/ntradebot/

```

## Deploy to production
```
Go to vps 
git pull origin master
```

### PM2
- Production dashboard: https://app.pm2.io/#/r/9pv7h7yfu43ug9r
- Staging dashboard: 

```
pm2 start npm --name ntradebot -- run production

Use `pm2 show <id|name>` to get more details about an app
Ex:
pm2 list
pm2 show ntradebot
```

### Backup bash `~/.bash_aliases`
```
alias pm2logs.home='cd ~/.pm2/logs/'

alias ntradebot.home='cd ~/workspace/ntrade-bot'
alias ntradebot.pull='ntradebot.home && git pull'
alias ntradebot.start='pm2 start npm --name ntradebot -- run production'
alias ntradebot.stop='pm2 stop ntradebot'
alias ntradebot.restart='pm2 restart ntradebot'
alias ntradebot.reload='pm2 reload ntradebot'
alias ntradebot.logs='pm2 logs ntradebot'

alias mongodb.status='sudo service mongod status'
alias mongodb.start='sudo service mongod start'
alias mongodb.stop='sudo service mongod stop'
alias mongodb.restart='sudo service mongod restart'

alias bash.up="source ~/.bash_aliases"
alias file.bash="nano ~/.bash_aliases"
```

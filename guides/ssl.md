# SSL on localhost

Prefer to do local development using SSL to resemble production as much as possible. If you're using `MacOS`, you can run this script to set everything up:

```sh
sudo sh ./scripts/ssl.sh
```

If you're not running `MacOS`, have a look at the `scripts/ssl.sh` script and adapt it to your OS.

## Running the SSL server

After running the script above, you can start your local server (`mix phx.server`) and test your domains using:

| URL                               | Product                | Production URL        |
| --------------------------------- | ---------------------- | --------------------- |
| https://localhost:4001            | Main app               | zoonk.com             |
| https://zoonk.test:4001           | Main app               | zoonk.com             |
| https://team.test:4001            | Teams, landing page    | zoonk.team            |
| https://myorg.team.test:4001      | Org white label        | myorg.zoonk.team      |
| https://school.test:4001          | Schools, landing page  | zoonk.school          |
| https://myschool.school.test:4001 | School white label     | myschool.zoonk.school |
| https://store.test:4001           | Creators, landing page | zoonk.store           |
| https://mystore.creator.test:4001 | Creator white label    | mypage.zoonk.io       |

**Note**: For testing the `Sign in with Apple` flow, you will need to add the `zoonk.app` domain to the `scripts/ssl.sh` file. Make sure to remove it later as it will redirect `zoonk.app` requests to `localhost`.

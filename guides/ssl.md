# SSL on localhost

Sometimes you may need to test SSL on your local machine. Have a look at the `scripts/ssl.sh` script on how to set it up. You can also find it [on GitHub](https://github.com/zoonk/zoonk/blob/main/scripts/ssl.sh).

## Running the SSL server

After running the script above, you can start your local server (`mix phx.server`) and test your domains using:

| URL                             | Product              | Production URL    |
| ------------------------------- | -------------------- | ----------------- |
| https://localhost:4001          | Main app             | zoonk.com         |
| https://zoonk.test:4001         | Main app             | zoonk.com         |
| https://public.zoonk.test:4001  | Public external org  | public.zoonk.app  |
| https://private.zoonk.test:4001 | Private external org | private.zoonk.app |

**Note**: For testing the `Sign in with Apple` flow, you will need to add the `zoonk.app` domain to the `scripts/ssl.sh` file. Make sure to remove it later as it will redirect `zoonk.app` requests to `localhost`.

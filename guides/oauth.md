# Testing OAuth

Make sure to create the environment variables below.

You can store them in a `.env` file and run `source .env` to load them. Alternatively, you can use [direnv](https://direnv.net/) to load them automatically.

## Google

You can create Google credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

You need to add `http://localhost:4000/auth/google/callback` to the list of authorized redirect URIs. If [using SSL](./ssl.md), you need to add `https://testdomain.app:4001/auth/google/callback` as well.

Note that Google doesn't allow to use a `.test` domain for the redirect URI.

```bash
export GOOGLE_CLIENT_ID=your_client_id
export GOOGLE_CLIENT_SECRET=your_client_secret
```

## GitHub

You can create GitHub credentials in the [GitHub Developer Settings](https://github.com/settings/developers).

Remember to add `http://localhost:4000/auth/github/callback` to the list of authorized redirect URIs.

```bash
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret
```

## Apple

You need to create an Apple Developer account to use Apple oAuth. After you've done it and logged in, you can create your credentials. You'll need the following data:

### Team ID

You can find it in the [Membership Details](https://developer.apple.com/account#MembershipDetailsCard) section. It's a 10-character string that looks like `ABCD1234EF`.

### App ID

You need an `App ID` before you can create a `Service ID`. You can create it in the [Certificates -> Identifiers](https://developer.apple.com/account/resources/identifiers/list) section.

On the `type` section, select `App`, even if you're using it for a web app. Then, make sure to select `Sign In with Apple` in the `Capabilities` section. Alternatively, you can use [this link](https://developer.apple.com/account/resources/identifiers/bundleId/add/bundle) to go directly to the add App ID page.

### Service ID

Go back to `Identifiers` and select the [Services IDs](https://developer.apple.com/account/resources/identifiers/list/serviceId) option on the dropdown menu on the top right. Then, click on the `+` button to create a new `Service ID`. Alternatively, you can use [this link](https://developer.apple.com/account/resources/identifiers/serviceId/add/) to go directly to the add Service ID page.

Your `Service ID` will be displayed as `Identifier` in the list of Service IDs. It should look like `com.yourcompany.yourapp`.

### Key ID and Private Key

Go to [Certificates -> Keys](https://developer.apple.com/account/resources/authkeys/list) and create a new key. Make sure to select `Sign In with Apple` in the `Key Services` section. Alternatively, you can use [this link](https://developer.apple.com/account/resources/authkeys/add) to go directly to the add Key page.

Store your private key in a safe place. You won't be able to download it again.

You'll be able to see your `Key ID` in the list of keys. It's a 10-character string that looks like `ABCD1234EF`.

### Update environment variables

Make sure to add the following variables to your environment:

```bash
export APPLE_SERVICE_ID=your_service_id
export APPLE_TEAM_ID=your_team_id
export APPLE_KEY_ID=your_key_id
export APPLE_PRIVATE_KEY=your_private_key
```

Apple's private key is a multi-line string. Make sure to keep the new lines. Otherwise, it won't work.

### Redirect URI

Apple doesn't allow using `localhost` or `.test` domains. So, for testing the `Sign in with Apple` flow, you will need to add a domain like `zoonk.app` to the `scripts/ssl.sh` file. Make sure to remove it after testing this flow as it will redirect `zoonk.app` requests to `localhost`.

Then, add the redirect URI to the list of authorized redirect URIs. It should look like `https://zoonk.app:4001/auth/apple/callback`.

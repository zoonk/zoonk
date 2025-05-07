# Deploying to Production

See [Phoenix's Deployment Guide](https://hexdocs.pm/phoenix/deployment.html) for more information on deploying a Phoenix application.

For things specific to Zoonk, see below.

## Environment Variables

Make sure to include the following environment variables in your production environment:

- `DATABASE_URL`: The URL of your PostgreSQL database.
- `SECRET_KEY_BASE`: A secret key used for signing and encrypting session data. You can generate one using `mix phx.gen.secret`.
- All variables for [OAuth providers](./oauth.md).

Optionally, you can include the following environment variables:

- `PHX_HOST`: The host of your Zoonk application (e.g., `zoonk.com`). Default is `zoonk.com`.
- `PORT`: The port on which your Zoonk application will run (e.g., `8080`).
- `POOL_SIZE`: The number of database connections to keep in the pool. The default is `10`.
- `DNS_CLUSTER_QUERY`: The DNS cluster query for your Zoonk application. See `DNSCluster` for more information.

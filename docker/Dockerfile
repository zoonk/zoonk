# Use the official Elixir image
FROM elixir:latest

# Install Hex + Rebar
RUN mix local.hex --force && \
  mix local.rebar --force

# Install inotify-tools
RUN apt-get update && \
  apt-get install -y inotify-tools && \
  apt-get clean

# Set the working directory
WORKDIR /app

# Copy the mix files
COPY mix.exs mix.lock ./

# Install Elixir dependencies
RUN mix deps.get

# Copy the rest of the application code
COPY . .

# Compile the Elixir project
RUN mix compile

# Expose the port the app runs on
EXPOSE 4000

# Set the default command to run the Phoenix server
CMD ["mix", "phx.server"]

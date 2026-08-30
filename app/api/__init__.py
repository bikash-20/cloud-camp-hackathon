"""HTTP routes — one module per resource.

Each router is mounted by `app.main:create_app`. Keep route handlers
thin: parse the request, delegate to a service in `app/services/` or
`app/seed/`, return a Pydantic model.
"""
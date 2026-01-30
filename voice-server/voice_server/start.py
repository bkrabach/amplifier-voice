import argparse
import logging
import uvicorn

from fastapi import FastAPI

from . import settings
from .service import FastAPILifespan, service_init

logging.config.dictConfig(settings.logging.config)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    lifespan = FastAPILifespan()    
    app = FastAPI(
        lifespan=lifespan.lifespan,
        title=settings.service.title,
        version=settings.service.version
    )
    service_init(
        app,
        register_lifespan_handler=lifespan.register_handler
    )
    return app


# Create app instance for uvicorn
app = create_app()


def main():

    parse_args = argparse.ArgumentParser(
        description=f"start the {settings.service.title} service",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parse_args.add_argument(
        "--host",
        dest="host",
        type=str,
        default=settings.service.host,
        help="host IP to run service on",
    )
    parse_args.add_argument(
        "--port",
        dest="port",
        type=int,
        default=settings.service.port,
        help="port to run service on"
    )
    args = parse_args.parse_args()

    logger.info("Starting voice server...")
    app = create_app()
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_config={"version": 1, "disable_existing_loggers": False},
    )

if __name__ == "__main__":
    main()

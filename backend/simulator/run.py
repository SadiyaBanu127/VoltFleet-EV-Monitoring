import asyncio

from app.services.simulator import simulation_loop


if __name__ == "__main__":
    asyncio.run(simulation_loop())

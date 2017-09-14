/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import express = require('express');
import {Facility} from 'meta2-logger';

/**
 * Server configuration
 */
export interface IServerConfig {
	/** Documentation output directory */
	outputDir: string;
	
	/** Server port */
	port: number;
}

/**
 * Server wrapper class
 */
export class Server {

	/** Logger facility instance */
	protected logger: Facility;

	/** Express app instance */
	protected app: express.Application;

	/** Server port */
	protected port: number;

	/** Last documentation modification time */
	protected lastModification: number = 0;

	/**
	 * Server constructor
	 *
	 * @param config Server configuration
	 * @param logger Logger facility
	 */
	public constructor(config: IServerConfig, logger: Facility){

		this.port = config.port;
		this.logger = logger;

		this.app = express();

		this.app.use(
			express.static( config.outputDir, { index: "index.html" } )
		);

		this.app.get("/_modified", (req: express.Request, res: express.Response) => {

			res.end( String(this.lastModification) );

		});

	}

	/**
	 * Updates modification time
	 */
	public setModified(){

		this.lastModification = Date.now();

	}

	/**
	 * Starts server
	 */
	public start(){

		this.logger.info("Starting express server on port " + this.port + "...");

		this.app.listen(this.port, () => {

			this.logger.info("Started.");

		});

	}

}
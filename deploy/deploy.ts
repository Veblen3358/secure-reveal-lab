import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSurveyReveal = await deploy("SurveyReveal", {
    from: deployer,
    log: true,
  });

  console.log(`SurveyReveal contract deployed at: `, deployedSurveyReveal.address);
};

export default func;
func.id = "deploy_surveyReveal";
func.tags = ["SurveyReveal"];






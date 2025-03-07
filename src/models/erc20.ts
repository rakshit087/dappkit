import * as Json from '@abi/Token.json';
import {Web3Connection} from '@base/web3-connection';
import {Model} from '@base/model';
import {TransactionReceipt} from '@interfaces/web3-core';
import {fromDecimals, fromSmartContractDecimals, toSmartContractDecimals} from '@utils/numbers';
import {Deployable} from '@interfaces/deployable';
import {ERC20Methods} from '@methods/erc20';
import {Web3ConnectionOptions} from '@interfaces/web3-connection-options';
import {Ownable} from "@base/ownable";

export class ERC20 extends Model<ERC20Methods> implements Deployable {
  constructor(web3Connection: Web3Connection|Web3ConnectionOptions, contractAddress?: string) {
    super(web3Connection, Json.abi as any, contractAddress);
  }

  private _decimals = 0;
  private _ownable!: Ownable;

  get decimals(): number { return this._decimals; }
  get ownable() { return this._ownable }

  async start() {
    await super.start();
    await this.loadContract();
  }

  async loadContract() {
    if (!this.contract)
      super.loadContract();

    this._ownable = new Ownable(this);

    this._decimals = await this.callTx(this.contract.methods.decimals()) || 18;
  }

  async name(): Promise<string> {
    return this.callTx(this.contract.methods.name());
  }

  async symbol(): Promise<string> {
    return this.callTx(this.contract.methods.symbol());
  }

  async totalSupply() {
    return fromDecimals(await this.callTx(this.contract.methods.totalSupply()), this.decimals);
  }

  async getTokenAmount(address: string) {
    return fromSmartContractDecimals(await this.callTx(this.contract.methods.balanceOf(address)), this.decimals);
  }

  async transferTokenAmount(toAddress: string, amount: string | number) {
    const tokenAmount = toSmartContractDecimals(amount, this.decimals);
    return this.sendTx(this.contract.methods.transfer(toAddress, tokenAmount));
  }

  async transferFrom(owner: string, receiver: string, amount: string | number) {
    amount = toSmartContractDecimals(amount, this.decimals);
    return this.sendTx(this.contract.methods.transferFrom(owner, receiver, amount));
  }

  async increaseAllowance(address: string, amount: string | number) {
    amount = toSmartContractDecimals(amount, this.decimals);
    return this.sendTx(this.contract.methods.increaseAllowance(address, amount));
  }

  async allowance(owner: string, spender: string) {
    return fromDecimals(await this.callTx(this.contract.methods.allowance(owner, spender)), this.decimals);
  }

  async isApproved(spenderAddress = this.contractAddress!, amount: string | number): Promise<boolean> {
    return await this.allowance(await this.connection.getAddress(), spenderAddress) >= amount;
  }

  async approve(address: string, amount: string | number): Promise<TransactionReceipt> {
    return this.sendTx(this.contract
                           .methods
                           .approve(address, toSmartContractDecimals(amount, this.decimals) ));
  }

  async deployJsonAbi(name: string,
                      symbol: string,
                      cap: string | number,
                      distributionAddress: string): Promise<TransactionReceipt> {
    const deployOptions = {
      data: Json.bytecode,
      arguments: [name, symbol, cap, distributionAddress]
    }

    return this.deploy(deployOptions, this.connection.Account);
  }

  async mint(receiver: string, amount: number) {
    await this._ownable.onlyOwner();
    return this.sendTx(this.contract.methods.mint(receiver, toSmartContractDecimals(amount, this._decimals)));
  }
}

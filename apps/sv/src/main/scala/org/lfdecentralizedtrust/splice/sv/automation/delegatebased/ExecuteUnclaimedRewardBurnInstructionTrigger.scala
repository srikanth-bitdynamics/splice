// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

package org.lfdecentralizedtrust.splice.sv.automation.delegatebased

import org.apache.pekko.stream.Materializer
import org.lfdecentralizedtrust.splice.automation.{
  OnAssignedContractTrigger,
  TaskOutcome,
  TaskSuccess,
  TriggerContext,
}
import org.lfdecentralizedtrust.splice.codegen.java.splice.dsorules.UnclaimedRewardBurnInstruction
import org.lfdecentralizedtrust.splice.util.AssignedContract
import com.digitalasset.canton.tracing.TraceContext
import io.opentelemetry.api.trace.Tracer
import org.lfdecentralizedtrust.splice.store.AppStoreWithIngestion.SpliceLedgerConnectionPriority

import scala.concurrent.{ExecutionContext, Future}
import scala.jdk.CollectionConverters.*

class ExecuteUnclaimedRewardBurnInstructionTrigger(
    override protected val context: TriggerContext,
    override protected val svTaskContext: SvTaskBasedTrigger.Context,
)(implicit
    ec: ExecutionContext,
    mat: Materializer,
    tracer: Tracer,
) extends OnAssignedContractTrigger.Template[
      UnclaimedRewardBurnInstruction.ContractId,
      UnclaimedRewardBurnInstruction,
    ](
      svTaskContext.dsoStore,
      UnclaimedRewardBurnInstruction.COMPANION,
    )
    with SvTaskBasedTrigger[AssignedContract[
      UnclaimedRewardBurnInstruction.ContractId,
      UnclaimedRewardBurnInstruction,
    ]] {

  override def completeTaskAsDsoDelegate(
      instruction: AssignedContract[
        UnclaimedRewardBurnInstruction.ContractId,
        UnclaimedRewardBurnInstruction,
      ],
      controller: String,
  )(implicit tc: TraceContext): Future[TaskOutcome] = {
    val store = svTaskContext.dsoStore
    for {
      dsoRules <- store.getDsoRules()
      unclaimedRewardsToBurnCids <-
        UnclaimedRewardSelection
          .collectSufficientUnclaimedRewards(store, instruction.payload.amount, logger)
          .map(_.map(_.contractId))
      cmd = dsoRules.exercise(
        _.exerciseDsoRules_ExecuteUnclaimedRewardBurnInstruction(
          instruction.contract.contractId,
          unclaimedRewardsToBurnCids.asJava,
          controller,
        )
      )
      _ <- svTaskContext
        .connection(SpliceLedgerConnectionPriority.Medium)
        .submit(
          Seq(store.key.svParty),
          Seq(store.key.dsoParty),
          cmd,
        )
        .noDedup
        .yieldUnit()
    } yield TaskSuccess("burned unclaimed rewards")
  }
}

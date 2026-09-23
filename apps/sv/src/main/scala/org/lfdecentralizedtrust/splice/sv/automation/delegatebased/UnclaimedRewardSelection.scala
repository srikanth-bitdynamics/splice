// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

package org.lfdecentralizedtrust.splice.sv.automation.delegatebased

import com.digitalasset.canton.logging.TracedLogger
import com.digitalasset.canton.tracing.TraceContext
import io.grpc.Status
import org.lfdecentralizedtrust.splice.codegen.java.splice.amulet.UnclaimedReward
import org.lfdecentralizedtrust.splice.store.PageLimit
import org.lfdecentralizedtrust.splice.sv.store.SvDsoStore
import org.lfdecentralizedtrust.splice.util.Contract

import scala.concurrent.{ExecutionContext, Future}

private[delegatebased] object UnclaimedRewardSelection {

  private val UNCLAIMED_REWARDS_LIMIT = PageLimit.tryCreate(100)

  def collectSufficientUnclaimedRewards(
      store: SvDsoStore,
      requiredAmount: BigDecimal,
      logger: TracedLogger,
  )(implicit
      tc: TraceContext,
      ec: ExecutionContext,
  ): Future[Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]]] =
    store.listUnclaimedRewards(UNCLAIMED_REWARDS_LIMIT).flatMap { unclaimedRewards =>
      val sortedUnclaimedRewards = unclaimedRewards.sortBy(_.payload.amount.negate())
      val (collectedUnclaimedRewards, collectedAmount) =
        takeSufficientUnclaimedRewards(sortedUnclaimedRewards, requiredAmount)
      if (collectedAmount < requiredAmount) {
        val errorMsg = s"Insufficient rewards: ${requiredAmount - collectedAmount}"
        logger.warn(errorMsg)
        Future.failed(
          Status.INTERNAL
            .withDescription(errorMsg)
            .asRuntimeException()
        )
      } else {
        Future.successful(collectedUnclaimedRewards)
      }
    }

  private def takeSufficientUnclaimedRewards(
      rewards: Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]],
      target: BigDecimal,
  ): (Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]], BigDecimal) = {
    @annotation.tailrec
    def loop(
        remaining: Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]],
        unclaimedRewardsAcc: Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]],
        amountAcc: BigDecimal,
    ): (Seq[Contract[UnclaimedReward.ContractId, UnclaimedReward]], BigDecimal) = {
      if (amountAcc >= target) (unclaimedRewardsAcc, amountAcc)
      else {
        remaining.toList match {
          case next :: remaining =>
            loop(remaining, unclaimedRewardsAcc :+ next, amountAcc + next.payload.amount)
          case Nil =>
            (unclaimedRewardsAcc, amountAcc) // no more elements to consume
        }
      }
    }

    loop(rewards, Seq.empty, BigDecimal(0))
  }
}
